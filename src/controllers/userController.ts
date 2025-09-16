import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Appointment from '../models/Appointment';
import { signAccessToken, signRefreshToken, verifyAccess } from '../utils/jwt';
import cloudinary from '../config/cloudinary';

// Register new user
export async function register(req: Request, res: Response) {
    try {
        const { email, password, firstName, lastName, phone } = req.body;
        if (!email || !password || !firstName || !lastName || !phone) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        if (phone.length !== 10) {
            return res.status(400).json({ error: 'Phone number must be 10 digits long' });
        }

        if (firstName.length < 3 || lastName.length < 3) {
            return res.status(400).json({ error: 'First and last name must be at least 3 characters long' });
        }
        if (!email.includes('@')) {
            return res.status(400).json({ error: 'Invalid email' });
        }
        if (!phone.startsWith('05')) {
            return res.status(400).json({ error: 'Phone number must start with 05' });
        }
        // Check if user already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(400).json({ error: 'Phone number already exists' });
        }
        const randomProfileImage = `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;
        let profileImageUrl: string | undefined;
        let profileImagePublicId: string | null = null;
        const file = (req as any).file as Express.Multer.File | undefined;
        if (file) {
            const uploadResult: any = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'barbershop', resource_type: 'image' },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                stream.end(file.buffer);
            });
            profileImageUrl = uploadResult.secure_url as string;
            profileImagePublicId = uploadResult.public_id as string;
        }
        // Create new user
        const user = new User({
            email,
            password,
            firstName,
            lastName,
            phone,
            profileImageData: {
                url: profileImageUrl || randomProfileImage,
                publicId: profileImagePublicId
            }
        });

        await user.save();

        // Generate tokens
        const accessToken = signAccessToken({ id: String(user._id), email: user.email, role: user.role });
        const refreshToken = signRefreshToken(String(user._id));

        // Return user data without password
        const userResponse = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            role: user.role,
            profileImageData: user.profileImageData
        };

        res.status(201).json({
            message: 'User registered successfully',
            user: userResponse,
            accessToken,
            refreshToken
        });
        console.log("User registered successfully", userResponse, "\naccessToken: ", accessToken, "\nrefreshToken: ", refreshToken);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Login user
export async function login(req: Request, res: Response) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({ error: 'Account is deactivated' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate tokens
        const accessToken = signAccessToken({ id: String(user._id), email: user.email, role: user.role });
        const refreshToken = signRefreshToken(String(user._id));

        // Return user data without password
        const userResponse = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            role: user.role,
            profileImageData: user.profileImageData
        };

        res.json({
            message: 'Login successful',
            user: userResponse,
            accessToken,
            refreshToken
        });
        console.log("Login successful", userResponse, "\naccessToken: ", accessToken, "\nrefreshToken: ", refreshToken);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Refresh access token
export async function refreshToken(req: Request, res: Response) {
    try {
        const { refreshToken } = req.body as { refreshToken?: string };
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        const { verifyRefresh } = await import('../utils/jwt');
        const payload = verifyRefresh(refreshToken);

        const user = await User.findById(payload.sub);
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid token or user inactive' });
        }

        const newAccessToken = signAccessToken({ id: String(user._id), email: user.email, role: user.role });
        console.log("New access token generated", newAccessToken);
        return res.json({ accessToken: newAccessToken });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
}

// Upload user profile image
// upload profile image to cloudinary and update user profile image
export async function uploadProfileImage(req: Request, res: Response) {
    try {

        // 1) בדיקת אותנטיקציה דרך טוקן שמגיע מהפרונט
        const authHeader = req.headers['authorization'] as string | undefined;
        const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        const bodyToken = (req as any).body?.accessToken as string | undefined;
        const token = headerToken || bodyToken;
        if (!token) return res.status(401).json({ error: 'Access token required' });

        let userId: string;
        try {
            const decoded = verifyAccess(token);
            userId = decoded.sub;
        } catch (e) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // 2) שליפת המשתמש
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // 3) קבלת הקובץ מ-multer (תומך גם single וגם array)
        const file: Express.Multer.File | undefined =
            (req as any).file || ((req as any).files?.[0] as Express.Multer.File | undefined);

        if (!file) return res.status(400).json({ error: "No image file provided" });
        if (!file.mimetype?.startsWith("image/")) {
            return res.status(415).json({ error: "Unsupported file type" });
        }

        // 4) העלאה לקלאודינרי (stream מה-buffer)
        const uploaded = await new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: "user_profiles", resource_type: "image" },
                (err, result) => {
                    if (err || !result) return reject(err || new Error("Upload failed"));
                    resolve(result);
                }
            );
            stream.end(file.buffer);
        });

        // 5) מחיקת תמונה ישנה (אם קיימת)
        if (user.profileImageData?.publicId) {
            try {
                await cloudinary.uploader.destroy(user.profileImageData.publicId);
            } catch (destroyErr) {
                console.warn("Failed to destroy old profile image:", destroyErr);
            }
        }

        // 6) שמירת הקישורים בשדה התמונה של המשתמש
        user.profileImageData = {
            url: uploaded.secure_url,
            publicId: uploaded.public_id
        };
        await user.save();

        // 7) תשובה
        return res.status(201).json({
            message: "Image uploaded and saved",
            profileImageData: user.profileImageData
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Cloudinary upload failed" });
    }
}



// Get user profile
export async function getProfile(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Update user profile
export async function updateProfile(req: Request, res: Response) {
    try {
        const userId = (req as any).user.id;
        const { firstName, lastName, email, phone, profileImage, currentPassword, newPassword } = req.body;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update basic info
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        // אם מגיע profileImage (מחרוזת URL) מהקליינט, נשמור אותו כ-url בתוך profileImageData
        if (typeof profileImage === 'string') {
            user.profileImageData = {
                url: profileImage,
                publicId: user.profileImageData?.publicId || null
            } as any;
        }

        // Handle password change if requested
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required to change password' });
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }

            // Hash new password
            const saltRounds = 12;
            user.password = await bcrypt.hash(newPassword, saltRounds);
        }
        console.log(user.email);
        // Save updated user
        await user.save();

        // Return updated user (without password)
        const updatedUser = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            role: user.role,
            profileImageData: user.profileImageData,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get all barbers (for customers to choose from)
export async function getBarbers(req: Request, res: Response) {
    try {
        const barbers = await User.find({
            role: 'barber',
            isActive: true
        }).select('-password');

        res.json({ barbers });
    } catch (error) {
        console.error('Get barbers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get user by ID (admin only)
export async function getUserById(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get all users (admin only)
export async function getAllUsers(req: Request, res: Response) {
    try {
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });

        res.json({ users });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Deactivate/Activate user (admin only)
export async function toggleUserStatus(req: Request, res: Response) {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            { isActive },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            user
        });
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get user's past appointments
export async function getPastAppointments(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get current date and time
        const currentTime = new Date();
        const currentDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 0, 0, 0, 0); // מנרמל לחצות
        const currentTimeString = currentTime.toTimeString().slice(0, 5); // פורמט "HH:MM"

        // Find past appointments:
        // 1. תאריכים שעברו (לא כולל היום)
        // 2. היום הנוכחי אבל שעות שעברו
        const pastAppointments = await Appointment.find({
            customer: userId,
            $or: [
                { date: { $lt: currentDate } }, // תאריכים שעברו
                {
                    date: currentDate,
                    startTime: { $lt: currentTimeString } // שעות שעברו היום
                }
            ]
        })
            .populate('barber', 'firstName lastName profileImageData')
            .populate('service', 'name description price durationMinutes category')
            .sort({ date: -1, startTime: -1 }) // Sort by date and time descending (most recent first)
            .lean();

        // Format the response
        const formattedAppointments = pastAppointments.map((appointment: any) => ({
            _id: appointment._id,
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            totalPrice: appointment.totalPrice,
            notes: appointment.notes,
            barber: {
                _id: appointment.barber._id,
                firstName: appointment.barber.firstName,
                lastName: appointment.barber.lastName,
                profileImageData: appointment.barber.profileImageData
            },
            service: {
                _id: appointment.service._id,
                name: appointment.service.name,
                description: appointment.service.description,
                price: appointment.service.price,
                durationMinutes: appointment.service.durationMinutes,
                category: appointment.service.category
            },
            createdAt: appointment.createdAt,
            updatedAt: appointment.updatedAt
        }));

        res.json({
            message: 'Past appointments retrieved successfully',
            appointments: formattedAppointments,
            totalCount: formattedAppointments.length,
            currentTime: currentTimeString,
            currentDate: currentDate.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Get past appointments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Update user's push token
export async function updatePushToken(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { token, platform } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Push token is required' });
        }

        if (platform && !['ios', 'android'].includes(platform)) {
            return res.status(400).json({ error: 'Platform must be ios or android' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            {
                pushToken: token,
                platform: platform || null
            },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Push token updated successfully',
            user: {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                profileImageData: user.profileImageData,
                pushToken: user.pushToken,
                platform: user.platform
            }
        });

    } catch (error) {
        console.error('Update push token error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Delete user (admin only) with Cloudinary cleanup
export async function deleteUser(req: Request, res: Response) {
    try {
        const { userId } = req.params as { userId: string };

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const publicId = (user as any).profileImageData?.publicId as string | undefined;

        await user.deleteOne();

        if (publicId) {
            try {
                await cloudinary.uploader.destroy(publicId);
            } catch (e) {
                console.warn('Failed to destroy Cloudinary image on user delete:', e);
            }
        }

        return res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}