import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import Service from '../models/Service';
import WorkingHours from '../models/WorkingHours';
import { Types } from 'mongoose';
import notificationService from '../services/notificationService';

// Create new appointment
export async function createAppointment(req: Request, res: Response) {
    try {
        const { barberId, serviceId, date, startTime, notes } = req.body;
        const customerId = (req as any).user?.id;
        console.log(date);
        if (!customerId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate service exists
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // נרמל את התאריך לחצות (midnight) כדי שהשדה date יהיה ללא זמן
        // Handle date string properly to avoid timezone issues
        const dateString = date as string;
        const [year, month, day] = dateString.split('-').map(Number);
        const appointmentDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)); // Use UTC to avoid timezone issues

        // Calculate end time based on service duration
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const startDateTime = new Date(appointmentDate);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const endDateTime = new Date(startDateTime.getTime() + service.durationMinutes * 60000);
        const endTime = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;

        // Check if the appointment time has already passed
        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
        const appointmentDay = new Date(Date.UTC(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate(), 0, 0, 0, 0));
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

        // שליחת הודעות push
        try {
            // הודעה ללקוח על קביעת התור
            await notificationService.sendAppointmentConfirmation(
                String(appointment.customer._id),
                appointment
            );

            // הודעה לספר על תור חדש
            await notificationService.sendNewAppointmentToBarber(
                String(appointment.barber._id),
                appointment
            );
        } catch (notificationError) {
            console.error('Error sending push notifications:', notificationError);
            // לא נכשל את הבקשה בגלל שגיאת הודעות
        }

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
        // Handle date string properly to avoid timezone issues
        const dateString = date as string;
        const [year, month, day] = dateString.split('-').map(Number);
        const normalizedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)); // Use UTC to avoid timezone issues
        const dayOfWeek = normalizedDate.getDay();

        // Get current date and time for comparison
        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
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

        // Populate appointment data for notifications before deletion
        await appointment.populate([
            { path: 'customer', select: 'firstName lastName email phone' },
            { path: 'barber', select: 'firstName lastName' },
            { path: 'service', select: 'name price durationMinutes' }
        ]);

        // Delete the appointment
        await Appointment.findByIdAndDelete(appointmentId);

        res.json({
            message: 'Appointment cancelled successfully'
        });

        // שליחת הודעות push על ביטול התור
        try {
            // הודעה ללקוח על ביטול התור
            await notificationService.sendAppointmentCancellation(
                String(appointment.customer._id),
                appointment
            );

            // הודעה לספר על ביטול התור
            await notificationService.sendAppointmentCancellation(
                String(appointment.barber._id),
                appointment
            );
        } catch (notificationError) {
            console.error('Error sending cancellation notifications:', notificationError);
        }

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
        const currentDate = new Date(Date.UTC(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 0, 0, 0, 0));
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

// Get all customers of a specific barber (with optional filtering by date)
export async function getBarberCustomers(req: Request, res: Response) {
    try {
        const { barberId } = req.params;
        const { limit = 50, page = 1, type = 'all' } = req.query; // type: 'all', 'future', 'past', 'today'

        if (!barberId) {
            return res.status(400).json({ error: 'Barber ID is required' });
        }

        // Get current date and time
        const currentTime = new Date();
        const currentDate = new Date(Date.UTC(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 0, 0, 0, 0));
        const currentTimeString = currentTime.toTimeString().slice(0, 5);

        // Build filter based on type
        let filter: any = { barber: barberId };

        if (type === 'future') {
            // Future appointments: future dates + future times today
            filter = {
                barber: barberId,
                $or: [
                    { date: { $gt: currentDate } }, // תאריכים עתידיים
                    {
                        date: currentDate,
                        startTime: { $gte: currentTimeString } // שעות עתידיות היום
                    }
                ]
            };
        } else if (type === 'past') {
            // Past appointments: past dates + past times today
            filter = {
                barber: barberId,
                $or: [
                    { date: { $lt: currentDate } }, // תאריכים שעברו
                    {
                        date: currentDate,
                        startTime: { $lt: currentTimeString } // שעות שעברו היום
                    }
                ]
            };
        } else if (type === 'today') {
            // Today's appointments only
            filter = {
                barber: barberId,
                date: currentDate // רק תאריכים של היום
            };
        }
        // If type === 'all', no additional filter is applied

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);

        // Get appointments
        const appointments = await Appointment.find(filter)
            .populate('customer', 'firstName lastName email phone profileImageData')
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
                phone: appointment.customer.phone,
                profileImageData: appointment.customer.profileImageData
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
            message: `Barber customers (${type}) retrieved successfully`,
            appointments: formattedAppointments,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalCount / Number(limit)),
                totalCount,
                limit: Number(limit)
            },
            currentTime: currentTimeString,
            currentDate: currentDate.toISOString().split('T')[0],
            filterType: type
        });

    } catch (error) {
        console.error('Get barber customers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Reschedule appointment to a new time
export async function rescheduleAppointment(req: Request, res: Response) {
    try {
        const { appointmentId } = req.params;
        const { newStartTime } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!newStartTime) {
            return res.status(400).json({ error: 'New start time is required' });
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(newStartTime)) {
            return res.status(400).json({ error: 'Invalid time format. Use HH:MM format' });
        }

        // Find the appointment
        const appointment = await Appointment.findById(appointmentId)
            .populate('service', 'durationMinutes')
            .populate('barber', 'firstName lastName')
            .populate('customer', 'firstName lastName email phone');

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Check if user is authorized to reschedule this appointment
        if (appointment.customer._id.toString() !== userId && appointment.barber._id.toString() !== userId) {
            return res.status(403).json({ error: 'Not authorized to reschedule this appointment' });
        }

        // Check if the appointment is in the future
        const currentTime = new Date();
        const appointmentDate = new Date(appointment.date);
        const appointmentDateTime = new Date(appointmentDate);
        const [startHour, startMinute] = appointment.startTime.split(':').map(Number);
        appointmentDateTime.setHours(startHour, startMinute, 0, 0);

        if (appointmentDateTime <= currentTime) {
            return res.status(400).json({ error: 'Cannot reschedule past appointments' });
        }

        // Calculate new end time based on service duration
        const [newStartHour, newStartMinute] = newStartTime.split(':').map(Number);
        const newStartDateTime = new Date(appointmentDate);
        newStartDateTime.setHours(newStartHour, newStartMinute, 0, 0);

        const newEndDateTime = new Date(newStartDateTime.getTime() + (appointment.service as any).durationMinutes * 60000);
        const newEndTime = `${newEndDateTime.getHours().toString().padStart(2, '0')}:${newEndDateTime.getMinutes().toString().padStart(2, '0')}`;

        // Check if the new time has already passed (for today)
        const currentDate = new Date(Date.UTC(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 0, 0, 0, 0));
        const appointmentDay = new Date(Date.UTC(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate(), 0, 0, 0, 0));
        const isToday = currentDate.getTime() === appointmentDay.getTime();

        if (isToday) {
            const currentTimeString = currentTime.toTimeString().slice(0, 5);
            if (newStartTime <= currentTimeString) {
                return res.status(400).json({ error: 'Cannot reschedule to past times' });
            }
        }

        // Check for conflicts with existing appointments (excluding current appointment)
        const conflictingAppointment = await Appointment.findOne({
            _id: { $ne: appointmentId }, // Exclude current appointment
            barber: appointment.barber._id,
            date: appointment.date,
            $or: [
                {
                    startTime: { $lt: newEndTime },
                    endTime: { $gt: newStartTime }
                }
            ]
        });

        if (conflictingAppointment) {
            return res.status(400).json({ error: 'הזמן החדש כבר תפוס' });
        }

        // Update the appointment
        appointment.startTime = newStartTime;
        appointment.endTime = newEndTime;
        await appointment.save();

        // Return updated appointment
        const updatedAppointment = await Appointment.findById(appointmentId)
            .populate('customer', 'firstName lastName email phone')
            .populate('barber', 'firstName lastName')
            .populate('service', 'name description price durationMinutes category');

        res.json({
            message: 'Appointment rescheduled successfully',
            appointment: updatedAppointment
        });

        // Send push notifications about reschedule
        try {
            // Note: sendAppointmentReschedule method needs to be implemented in notificationService
            console.log('Appointment rescheduled:', {
                customerId: appointment.customer._id,
                barberId: appointment.barber._id,
                newTime: newStartTime
            });
        } catch (notificationError) {
            console.error('Error sending reschedule notifications:', notificationError);
        }

    } catch (error) {
        console.error('Reschedule appointment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}