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
