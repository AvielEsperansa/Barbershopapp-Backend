import { Request, Response } from 'express';
import Appointment from '../models/Appointment';
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

