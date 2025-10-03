import { Request, Response } from 'express';
import Rating, { IRating } from '../models/Rating';
import Appointment from '../models/Appointment';
import User from '../models/User';

// Create a new rating
export const createRating = async (req: Request, res: Response) => {
    try {
        const { appointmentId, rating, review } = req.body;
        const customerId = (req as any).user?.id;

        if (!customerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        // Check if appointment exists and belongs to the customer
        const appointment = await Appointment.findById(appointmentId)
            .populate('customer', 'firstName lastName')
            .populate('barber', 'firstName lastName');

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.customer._id.toString() !== customerId) {
            return res.status(403).json({ message: 'You can only rate your own appointments' });
        }

        // Check if appointment is completed (date and time have passed)
        const currentTime = new Date();
        const appointmentDate = new Date(appointment.date);
        const [startHour, startMinute] = appointment.startTime.split(':').map(Number);

        // Create appointment datetime
        const appointmentDateTime = new Date(appointmentDate);
        appointmentDateTime.setHours(startHour, startMinute, 0, 0);

        // Check if appointment time has passed
        if (appointmentDateTime > currentTime) {
            return res.status(400).json({ message: 'You can only rate appointments that have already passed' });
        }

        // Check if rating already exists for this appointment
        const existingRating = await Rating.findOne({ appointment: appointmentId });
        if (existingRating) {
            return res.status(400).json({ message: 'You have already rated this appointment' });
        }

        // Create new rating
        const newRating = new Rating({
            customer: customerId,
            barber: appointment.barber._id,
            appointment: appointmentId,
            rating,
            review: review || undefined
        });
        console.log('New rating:', newRating);
        await newRating.save();

        // Populate the response
        await newRating.populate([
            { path: 'customer', select: 'firstName lastName' },
            { path: 'barber', select: 'firstName lastName' },
            { path: 'appointment', select: 'date startTime endTime service' }
        ]);

        res.status(201).json({
            message: 'Rating created successfully',
            rating: newRating
        });

    } catch (error) {
        console.error('Error creating rating:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update an existing rating
export const updateRating = async (req: Request, res: Response) => {
    try {
        const { ratingId } = req.params;
        const { rating, review } = req.body;
        const customerId = (req as any).user?.id;

        if (!customerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        // Find the rating
        const existingRating = await Rating.findById(ratingId)
            .populate('customer', 'firstName lastName')
            .populate('barber', 'firstName lastName')
            .populate('appointment', 'date startTime endTime service');

        if (!existingRating) {
            return res.status(404).json({ message: 'Rating not found' });
        }

        // Check if the customer owns this rating
        if (existingRating.customer._id.toString() !== customerId) {
            return res.status(403).json({ message: 'You can only update your own ratings' });
        }

        // Update the rating
        existingRating.rating = rating;
        if (review !== undefined) {
            existingRating.review = review || undefined;
        }

        await existingRating.save();

        res.json({
            message: 'Rating updated successfully',
            rating: existingRating
        });

    } catch (error) {
        console.error('Error updating rating:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get ratings for a specific barber
export const getRatingsByBarber = async (req: Request, res: Response) => {
    try {
        const { barberId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Check if barber exists
        const barber = await User.findById(barberId);
        if (!barber) {
            return res.status(404).json({ message: 'Barber not found' });
        }

        // Get ratings with pagination
        const ratings = await Rating.find({ barber: barberId })
            .populate('customer', 'firstName lastName')
            .populate('appointment', 'date startTime endTime service')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalRatings = await Rating.countDocuments({ barber: barberId });

        // Calculate average rating
        const averageRating = await Rating.aggregate([
            { $match: { barber: barber._id } },
            { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);

        const stats = averageRating.length > 0 ? averageRating[0] : { average: 0, count: 0 };

        res.json({
            ratings,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalRatings / limit),
                totalRatings,
                hasNext: page < Math.ceil(totalRatings / limit),
                hasPrev: page > 1
            },
            stats: {
                averageRating: Math.round(stats.average * 10) / 10, // Round to 1 decimal
                totalRatings: stats.count
            }
        });

    } catch (error) {
        console.error('Error getting ratings by barber:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get rating for a specific appointment
export const getRatingByAppointment = async (req: Request, res: Response) => {
    try {
        const { appointmentId } = req.params;
        const customerId = (req as any).user?.id;

        if (!customerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Check if appointment exists and belongs to the customer
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.customer.toString() !== customerId) {
            return res.status(403).json({ message: 'You can only view ratings for your own appointments' });
        }

        // Find the rating
        const rating = await Rating.findOne({ appointment: appointmentId })
            .populate('customer', 'firstName lastName')
            .populate('barber', 'firstName lastName')
            .populate('appointment', 'date startTime endTime service');

        if (!rating) {
            return res.status(404).json({ message: 'No rating found for this appointment' });
        }

        res.json({ rating });

    } catch (error) {
        console.error('Error getting rating by appointment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get barber's rating statistics
export const getBarberRatingStats = async (req: Request, res: Response) => {
    try {
        const { barberId } = req.params;

        // Check if barber exists
        const barber = await User.findById(barberId);
        if (!barber) {
            return res.status(404).json({ message: 'Barber not found' });
        }

        // Get rating statistics
        const stats = await Rating.aggregate([
            { $match: { barber: barber._id } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalRatings: { $sum: 1 },
                    ratingDistribution: {
                        $push: '$rating'
                    }
                }
            }
        ]);

        if (stats.length === 0) {
            return res.json({
                barber: {
                    _id: barber._id,
                    firstName: barber.firstName,
                    lastName: barber.lastName
                },
                stats: {
                    averageRating: 0,
                    totalRatings: 0,
                    ratingDistribution: {
                        1: 0,
                        2: 0,
                        3: 0,
                        4: 0,
                        5: 0
                    }
                }
            });
        }

        const result = stats[0];
        const ratingDistribution = result.ratingDistribution.reduce((acc: any, rating: number) => {
            acc[rating] = (acc[rating] || 0) + 1;
            return acc;
        }, {});

        // Ensure all ratings 1-5 are represented
        for (let i = 1; i <= 5; i++) {
            if (!ratingDistribution[i]) {
                ratingDistribution[i] = 0;
            }
        }

        res.json({
            barber: {
                _id: barber._id,
                firstName: barber.firstName,
                lastName: barber.lastName
            },
            stats: {
                averageRating: Math.round(result.averageRating * 10) / 10, // Round to 1 decimal
                totalRatings: result.totalRatings,
                ratingDistribution
            }
        });

    } catch (error) {
        console.error('Error getting barber rating stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get user's ratings
export const getUserRatings = async (req: Request, res: Response) => {
    try {
        const customerId = (req as any).user?.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        if (!customerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get user's ratings with pagination
        const ratings = await Rating.find({ customer: customerId })
            .populate('barber', 'firstName lastName')
            .populate('appointment', 'date startTime endTime service')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalRatings = await Rating.countDocuments({ customer: customerId });

        res.json({
            ratings,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalRatings / limit),
                totalRatings,
                hasNext: page < Math.ceil(totalRatings / limit),
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error getting user ratings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get user's completed appointments that can be rated
export const getUserRateableAppointments = async (req: Request, res: Response) => {
    try {
        const customerId = (req as any).user?.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        if (!customerId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const currentTime = new Date();

        // Get user's appointments that have passed and can be rated
        const appointments = await Appointment.find({ customer: customerId })
            .populate('barber', 'firstName lastName')
            .populate('service', 'name price durationMinutes')
            .sort({ date: -1, startTime: -1 })
            .skip(skip)
            .limit(limit);

        // Filter appointments that have passed
        const rateableAppointments = appointments.filter(appointment => {
            const appointmentDate = new Date(appointment.date);
            const [startHour, startMinute] = appointment.startTime.split(':').map(Number);
            const appointmentDateTime = new Date(appointmentDate);
            appointmentDateTime.setHours(startHour, startMinute, 0, 0);
            return appointmentDateTime <= currentTime;
        });

        // Check which appointments already have ratings
        const appointmentIds = rateableAppointments.map(apt => apt._id);
        const existingRatings = await Rating.find({
            appointment: { $in: appointmentIds },
            customer: customerId
        }).select('appointment');

        const ratedAppointmentIds = new Set(existingRatings.map(rating => rating.appointment.toString()));

        // Add rating status to each appointment
        const appointmentsWithRatingStatus = rateableAppointments.map(appointment => ({
            ...appointment.toObject(),
            canBeRated: !ratedAppointmentIds.has(appointment._id.toString()),
            hasRating: ratedAppointmentIds.has(appointment._id.toString())
        }));

        // Get total count for pagination (only rateable appointments)
        const totalAppointments = await Appointment.countDocuments({ customer: customerId });
        const allAppointments = await Appointment.find({ customer: customerId });
        const totalRateable = allAppointments.filter(appointment => {
            const appointmentDate = new Date(appointment.date);
            const [startHour, startMinute] = appointment.startTime.split(':').map(Number);
            const appointmentDateTime = new Date(appointmentDate);
            appointmentDateTime.setHours(startHour, startMinute, 0, 0);
            return appointmentDateTime <= currentTime;
        }).length;

        res.json({
            appointments: appointmentsWithRatingStatus,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalRateable / limit),
                totalRateable,
                hasNext: page < Math.ceil(totalRateable / limit),
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error getting user rateable appointments:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
