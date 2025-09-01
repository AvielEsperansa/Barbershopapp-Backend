import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { signAccessToken, signRefreshToken } from '../utils/jwt';
import { v2 as cloudinary } from 'cloudinary';

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
        }
        // Create new user
        const user = new User({
            email,
            password,
            firstName,
            lastName,
            phone,
            profileImage: profileImageUrl || randomProfileImage
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
            profileImage: user.profileImage
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
            profileImage: user.profileImage
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
        if (profileImage !== undefined) user.profileImage = profileImage;

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
            profileImage: user.profileImage,
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

        // Import Appointment model
        const Appointment = (await import('../models/Appointment')).default;

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
            .populate('barber', 'firstName lastName profileImage')
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
                profileImage: appointment.barber.profileImage
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
