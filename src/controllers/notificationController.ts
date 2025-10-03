import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
import Rating from '../models/Rating';
import notificationService from '../services/notificationService';

// שליחת תזכורות תורים (24 שעות לפני התור)
export async function sendAppointmentReminders(req: Request, res: Response) {
    try {
        // קבלת תאריך מחר
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        // מציאת כל התורים של מחר
        const tomorrowAppointments = await Appointment.find({
            date: tomorrow
        })
            .populate('customer', 'firstName lastName')
            .populate('barber', 'firstName lastName')
            .populate('service', 'name durationMinutes');

        let successCount = 0;
        let failedCount = 0;

        // שליחת תזכורת לכל תור
        for (const appointment of tomorrowAppointments) {
            try {
                const success = await notificationService.sendAppointmentReminder(
                    String(appointment.customer._id),
                    appointment
                );

                if (success) {
                    successCount++;
                } else {
                    failedCount++;
                }
            } catch (error) {
                console.error(`Error sending reminder for appointment ${appointment._id}:`, error);
                failedCount++;
            }
        }

        res.json({
            message: 'Appointment reminders sent',
            totalAppointments: tomorrowAppointments.length,
            successCount,
            failedCount,
            date: tomorrow.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Send appointment reminders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Send rating reminders for completed appointments
export async function sendRatingReminders(req: Request, res: Response) {
    try {
        const currentTime = new Date();

        // Find appointments that ended in the last 2 hours (to give time for completion)
        const twoHoursAgo = new Date(currentTime.getTime() - 2 * 60 * 60 * 1000);

        // Get appointments that have passed
        const completedAppointments = await Appointment.find({
            $or: [
                { date: { $lt: new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate()) } }, // Past dates
                {
                    date: new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate()),
                    startTime: { $lt: currentTime.toTimeString().slice(0, 5) } // Past times today
                }
            ]
        })
            .populate('customer', 'firstName lastName')
            .populate('barber', 'firstName lastName')
            .populate('service', 'name durationMinutes');

        // Filter appointments that ended in the last 2 hours
        const recentCompletedAppointments = completedAppointments.filter(appointment => {
            const appointmentDate = new Date(appointment.date);
            const [startHour, startMinute] = appointment.startTime.split(':').map(Number);
            const [endHour, endMinute] = appointment.endTime.split(':').map(Number);

            const appointmentStartTime = new Date(appointmentDate);
            appointmentStartTime.setHours(startHour, startMinute, 0, 0);

            const appointmentEndTime = new Date(appointmentDate);
            appointmentEndTime.setHours(endHour, endMinute, 0, 0);

            return appointmentEndTime <= currentTime && appointmentEndTime >= twoHoursAgo;
        });

        let successCount = 0;
        let failedCount = 0;

        // Check which appointments already have ratings
        const appointmentIds = recentCompletedAppointments.map(apt => apt._id);
        const existingRatings = await Rating.find({
            appointment: { $in: appointmentIds }
        }).select('appointment');

        const ratedAppointmentIds = new Set(existingRatings.map((rating: any) => rating.appointment.toString()));

        // Send rating reminders for appointments without ratings
        for (const appointment of recentCompletedAppointments) {
            if (!ratedAppointmentIds.has(appointment._id.toString())) {
                try {
                    const success = await notificationService.sendRatingReminder(
                        String(appointment.customer._id),
                        appointment
                    );

                    if (success) {
                        successCount++;
                    } else {
                        failedCount++;
                    }
                } catch (error) {
                    console.error(`Error sending rating reminder for appointment ${appointment._id}:`, error);
                    failedCount++;
                }
            }
        }

        res.json({
            message: 'Rating reminders sent',
            totalAppointments: recentCompletedAppointments.length,
            appointmentsWithRatings: ratedAppointmentIds.size,
            appointmentsWithoutRatings: recentCompletedAppointments.length - ratedAppointmentIds.size,
            successCount,
            failedCount
        });

    } catch (error) {
        console.error('Send rating reminders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// שליחת הודעה מותאמת אישית
export async function sendCustomNotification(req: Request, res: Response) {
    try {
        const { userIds, title, body, data } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'User IDs array is required' });
        }

        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body are required' });
        }

        const result = await notificationService.sendToMultipleUsers(userIds, {
            title,
            body,
            data: data || {}
        });

        res.json({
            message: 'Custom notification sent',
            successCount: result.success,
            failedCount: result.failed,
            totalSent: userIds.length
        });

    } catch (error) {
        console.error('Send custom notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// שליחת הודעה לכל הספרים
export async function sendNotificationToAllBarbers(req: Request, res: Response) {
    try {
        const { title, body, data } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body are required' });
        }

        const result = await notificationService.sendToAllBarbers({
            title,
            body,
            data: data || {}
        });

        res.json({
            message: 'Notification sent to all barbers',
            successCount: result.success,
            failedCount: result.failed
        });

    } catch (error) {
        console.error('Send notification to all barbers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// שליחת הודעה לכל הלקוחות
export async function sendNotificationToAllCustomers(req: Request, res: Response) {
    try {
        const { title, body, data } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body are required' });
        }

        const result = await notificationService.sendToAllCustomers({
            title,
            body,
            data: data || {}
        });

        res.json({
            message: 'Notification sent to all customers',
            successCount: result.success,
            failedCount: result.failed
        });

    } catch (error) {
        console.error('Send notification to all customers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ניקוי טוקנים לא תקינים
export async function validateAndCleanTokens(req: Request, res: Response) {
    try {
        await notificationService.validateAndCleanTokens();

        res.json({
            message: 'Token validation and cleanup completed'
        });

    } catch (error) {
        console.error('Validate and clean tokens error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

