import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import Service from '../models/Service';
import WorkingHours from '../models/WorkingHours';
import { Types } from 'mongoose';

// Create new appointment
export async function createAppointment(req: Request, res: Response) {
    try {
        const { barberId, serviceId, date, startTime, notes } = req.body;
        const customerId = (req as any).user?.id;

        if (!customerId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate service exists
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // נרמל את התאריך לחצות (midnight) כדי שהשדה date יהיה ללא זמן
        let appointmentDate = new Date(date);
        appointmentDate = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate(), 0, 0, 0, 0);

        // Calculate end time based on service duration
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const startDateTime = new Date(appointmentDate);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const endDateTime = new Date(startDateTime.getTime() + service.durationMinutes * 60000);
        const endTime = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;

        // Check if the appointment time has already passed
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
        const isToday = today.getTime() === appointmentDay.getTime();

        if (isToday) {
            const currentTimeString = now.toTimeString().slice(0, 5); // Format: "HH:MM"
            if (startTime <= currentTimeString) {
                return res.status(400).json({ error: 'Cannot book appointments for past times' });
            }
        }

        // Ensure the customer does not already have another appointment on the same day
        const existingSameDay = await Appointment.findOne({
            customer: customerId,
            date: appointmentDate
        });

        if (existingSameDay) {
            return res.status(400).json({ error: 'User already has an appointment on this day' });
        }

        // Check if barber is available at this time
        const dayOfWeek = appointmentDate.getDay();
        const workingHours = await WorkingHours.findOne({
            barber: barberId,
            dayOfWeek,
            isWorking: true
        });

        if (!workingHours) {
            return res.status(400).json({ error: 'Barber is not working on this day' });
        }

        if (startTime < workingHours.startTime || endTime > workingHours.endTime) {
            return res.status(400).json({ error: 'Appointment time is outside working hours' });
        }

        // Check for conflicts with existing appointments
        const conflictingAppointment = await Appointment.findOne({
            barber: barberId,
            date: appointmentDate,
            $or: [
                {
                    startTime: { $lt: endTime },
                    endTime: { $gt: startTime }
                }
            ]
        });

        if (conflictingAppointment) {
            return res.status(400).json({ error: 'הזמן הזה כבר תפוס' });
        }

        // Create appointment
        const appointment = new Appointment({
            customer: customerId,
            barber: barberId,
            service: serviceId,
            date: appointmentDate,
            startTime,
            endTime,
            totalPrice: service.price,
            notes
        });

        await appointment.save();

        // Populate references for response
        await appointment.populate([
            { path: 'customer', select: 'firstName lastName email phone' },
            { path: 'barber', select: 'firstName lastName' },
            { path: 'service', select: 'name price durationMinutes' }
        ]);

        res.status(201).json({
            message: 'Appointment created successfully',
            appointment
        });
        console.log(appointment);

    } catch (error) {
        console.error('Create appointment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get available time slots for a specific date and barber
export async function getAvailableSlots(req: Request, res: Response) {
    try {
        const { date, barberId } = req.query;

        if (!date || !barberId) {
            return res.status(400).json({ error: 'Date and barber ID are required' });
        }

        // Parse and normalize the selected date to midnight
        const selectedDate = new Date(date as string);
        const normalizedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
        const dayOfWeek = normalizedDate.getDay();

        // Get current date and time for comparison
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const isToday = today.getTime() === normalizedDate.getTime();
        const currentTimeString = now.toTimeString().slice(0, 5); // Format: "HH:MM"

        // Get working hours for the barber on this day
        const workingHours = await WorkingHours.findOne({
            barber: barberId,
            dayOfWeek,
            isWorking: true
        });

        if (!workingHours) {
            return res.status(400).json({ error: 'Barber is not working on this day' });
        }

        // Get existing appointments for this barber on this date
        const existingAppointments = await Appointment.find({
            barber: barberId,
            date: normalizedDate
        });

        console.log('Existing appointments for date:', normalizedDate.toISOString().split('T')[0]);
        console.log('Existing appointments:', existingAppointments.map(apt => ({
            startTime: apt.startTime,
            endTime: apt.endTime
        })));

        // Generate time slots (30-minute intervals)
        const slots: any[] = [];
        const [startHour, startMinute] = workingHours.startTime.split(':').map(Number);
        const [endHour, endMinute] = workingHours.endTime.split(':').map(Number);

        let currentTime = new Date(normalizedDate);
        currentTime.setHours(startHour, startMinute, 0, 0);

        const endTime = new Date(normalizedDate);
        endTime.setHours(endHour, endMinute, 0, 0);

        while (currentTime < endTime) {
            const slotStart = currentTime.toTimeString().slice(0, 5);
            const slotEnd = new Date(currentTime.getTime() + 30 * 60000).toTimeString().slice(0, 5);

            // Check if slot conflicts with existing appointments
            const hasConflict = existingAppointments.some(appointment => {
                // Check for overlap: slot starts before appointment ends AND slot ends after appointment starts
                const conflict = slotStart < appointment.endTime && slotEnd > appointment.startTime;
                if (conflict) {
                    console.log(`Conflict found: Slot ${slotStart}-${slotEnd} conflicts with appointment ${appointment.startTime}-${appointment.endTime}`);
                }
                return conflict;
            });

            // Check if slot is in the past (for today)
            const isSlotInPast = isToday && slotStart <= currentTimeString;

            // Only add slots that are available and not in the past
            if (!hasConflict && !isSlotInPast) {
                slots.push({
                    startTime: slotStart,
                    endTime: slotEnd,
                    isAvailable: true
                });
            }

            currentTime.setMinutes(currentTime.getMinutes() + 30);
        }

        res.json({
            slots,
            workingHours: {
                startTime: workingHours.startTime,
                endTime: workingHours.endTime,
                dayOfWeek: workingHours.dayOfWeek
            },
            date: normalizedDate.toISOString().split('T')[0],
            barberId: barberId
        });

    } catch (error) {
        console.error('Get available slots error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get user's appointments
export async function getUserAppointments(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        const { limit = 10, page = 1 } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const filter: any = { customer: userId };

        const appointments = await Appointment.find(filter)
            .populate('barber', 'firstName lastName')
            .populate('service', 'name price durationMinutes')
            .sort({ date: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await Appointment.countDocuments(filter);

        res.json({
            appointments,
            pagination: {
                current: Number(page),
                total: Math.ceil(total / Number(limit)),
                hasNext: Number(page) * Number(limit) < total,
                hasPrev: Number(page) > 1
            }
        });

    } catch (error) {
        console.error('Get user appointments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Cancel appointment
export async function cancelAppointment(req: Request, res: Response) {
    try {
        const { appointmentId } = req.params;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Check if user is authorized to cancel this appointment
        if (appointment.customer.toString() !== userId && appointment.barber.toString() !== userId) {
            return res.status(403).json({ error: 'Not authorized to cancel this appointment' });
        }

        // Delete the appointment
        await Appointment.findByIdAndDelete(appointmentId);

        res.json({
            message: 'Appointment cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel appointment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get barber's appointment history
export async function getBarberAppointmentHistory(req: Request, res: Response) {
    try {
        const { barberId } = req.params;
        const { startDate, endDate, limit = 50, page = 1 } = req.query;

        if (!barberId) {
            return res.status(400).json({ error: 'Barber ID is required' });
        }

        // Build filter
        let filter: any = { barber: barberId };

        // Add date range if provided
        if (startDate && endDate) {
            filter.date = {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string)
            };
        }

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);

        // Get appointments with pagination
        const appointments = await Appointment.find(filter)
            .populate('customer', 'firstName lastName email phone')
            .populate('service', 'name description price durationMinutes category')
            .sort({ date: -1, startTime: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        // Get total count for pagination
        const totalCount = await Appointment.countDocuments(filter);

        // Format response
        const formattedAppointments = appointments.map((appointment: any) => ({
            _id: appointment._id,
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            totalPrice: appointment.totalPrice,
            notes: appointment.notes,
            customer: {
                _id: appointment.customer._id,
                firstName: appointment.customer.firstName,
                lastName: appointment.customer.lastName,
                email: appointment.customer.email,
                phone: appointment.customer.phone
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
            message: 'Barber appointment history retrieved successfully',
            appointments: formattedAppointments,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalCount / Number(limit)),
                totalCount,
                limit: Number(limit)
            }
        });

    } catch (error) {
        console.error('Get barber appointment history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get barber's appointment statistics
export async function getBarberAppointmentStats(req: Request, res: Response) {
    try {
        const { barberId } = req.params;
        const { startDate, endDate } = req.query;

        if (!barberId) {
            return res.status(400).json({ error: 'Barber ID is required' });
        }

        // Build date filter
        let dateFilter: any = {};
        if (startDate && endDate) {
            dateFilter = {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string)
            };
        }

        // Get total appointments
        const totalAppointments = await Appointment.countDocuments({
            barber: barberId,
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
        });

        // Get total revenue
        const revenueResult = await Appointment.aggregate([
            {
                $match: {
                    barber: new Types.ObjectId(barberId),
                    ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalPrice' }
                }
            }
        ]);

        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

        // Get appointments by month (last 12 months)
        const monthlyStats = await Appointment.aggregate([
            {
                $match: {
                    barber: new Types.ObjectId(barberId),
                    date: { $gte: new Date(new Date().getFullYear() - 1, 0, 1) }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalPrice' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Get most popular services
        const popularServices = await Appointment.aggregate([
            {
                $match: {
                    barber: new Types.ObjectId(barberId),
                    ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
                }
            },
            {
                $group: {
                    _id: '$service',
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$totalPrice' }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 5
            }
        ]);

        // Populate service details
        const populatedPopularServices = await Appointment.populate(popularServices, {
            path: '_id',
            select: 'name description price durationMinutes category'
        });

        res.json({
            message: 'Barber appointment statistics retrieved successfully',
            stats: {
                totalAppointments,
                totalRevenue,
                monthlyStats,
                popularServices: populatedPopularServices
            }
        });

    } catch (error) {
        console.error('Get barber appointment stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get barber's completed appointments (past appointments)
export async function getBarberCompletedAppointments(req: Request, res: Response) {
    try {
        const { barberId } = req.params;
        const { limit = 50, page = 1 } = req.query;

        if (!barberId) {
            return res.status(400).json({ error: 'Barber ID is required' });
        }

        // Get current date and time
        const currentTime = new Date();
        const currentDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 0, 0, 0, 0);
        const currentTimeString = currentTime.toTimeString().slice(0, 5);

        // Find completed appointments (past dates + past times today)
        const filter = {
            barber: barberId,
            $or: [
                { date: { $lt: currentDate } }, // תאריכים שעברו
                {
                    date: currentDate,
                    startTime: { $lt: currentTimeString } // שעות שעברו היום
                }
            ]
        };

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);

        // Get completed appointments
        const appointments = await Appointment.find(filter)
            .populate('customer', 'firstName lastName email phone')
            .populate('service', 'name description price durationMinutes category')
            .sort({ date: -1, startTime: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        // Get total count
        const totalCount = await Appointment.countDocuments(filter);

        // Format response
        const formattedAppointments = appointments.map((appointment: any) => ({
            _id: appointment._id,
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            totalPrice: appointment.totalPrice,
            notes: appointment.notes,
            customer: {
                _id: appointment.customer._id,
                firstName: appointment.customer.firstName,
                lastName: appointment.customer.lastName,
                email: appointment.customer.email,
                phone: appointment.customer.phone
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
            message: 'Barber completed appointments retrieved successfully',
            appointments: formattedAppointments,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalCount / Number(limit)),
                totalCount,
                limit: Number(limit)
            },
            currentTime: currentTimeString,
            currentDate: currentDate.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Get barber completed appointments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
