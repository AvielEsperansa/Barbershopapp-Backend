import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import User from '../models/User';

// יצירת instance של Expo SDK
const expo = new Expo();

export interface NotificationData {
    type: 'appointment_confirmation' | 'appointment_cancellation' | 'appointment_update' | 'appointment_reminder' | 'barber_day_off' | 'new_appointment';
    appointmentId?: string;
    dayOffId?: string;
    oldAppointment?: any;
    newAppointment?: any;
    [key: string]: any;
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: NotificationData;
    sound?: 'default' | null;
    badge?: number;
    channelId?: string;
}

class NotificationService {
    /**
     * שליחת הודעה למשתמש ספציפי
     */
    async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
        try {
            const user = await User.findById(userId).select('pushToken platform');
            if (!user || !user.pushToken) {
                console.log(`User ${userId} has no push token`);
                return false;
            }

            // בדיקה שהטוקן תקין
            if (!Expo.isExpoPushToken(user.pushToken)) {
                console.log(`Invalid push token for user ${userId}: ${user.pushToken}`);
                return false;
            }

            const message: ExpoPushMessage = {
                to: user.pushToken,
                title: payload.title,
                body: payload.body,
                data: payload.data || {},
                sound: payload.sound || 'default',
                badge: payload.badge,
                channelId: user.platform === 'android' ? 'barbershop-notifications' : undefined,
            };

            const chunks = expo.chunkPushNotifications([message]);
            const tickets: ExpoPushTicket[] = [];

            for (const chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    tickets.push(...ticketChunk);
                } catch (error) {
                    console.error('Error sending push notification chunk:', error);
                }
            }

            console.log(`Push notification sent to user ${userId}`);
            return true;

        } catch (error) {
            console.error(`Error sending push notification to user ${userId}:`, error);
            return false;
        }
    }

    /**
     * שליחת הודעה למספר משתמשים
     */
    async sendToMultipleUsers(userIds: string[], payload: PushNotificationPayload): Promise<{ success: number; failed: number }> {
        const results = await Promise.allSettled(
            userIds.map(userId => this.sendToUser(userId, payload))
        );

        const success = results.filter(result => result.status === 'fulfilled' && result.value === true).length;
        const failed = results.length - success;

        return { success, failed };
    }

    /**
     * שליחת הודעה לכל הספרים
     */
    async sendToAllBarbers(payload: PushNotificationPayload): Promise<{ success: number; failed: number }> {
        try {
            const barbers = await User.find({
                role: 'barber',
                isActive: true,
                pushToken: { $exists: true, $ne: null }
            }).select('_id');

            const barberIds = barbers.map(barber => String(barber._id));
            return await this.sendToMultipleUsers(barberIds, payload);

        } catch (error) {
            console.error('Error sending to all barbers:', error);
            return { success: 0, failed: 0 };
        }
    }

    /**
     * שליחת הודעה לכל הלקוחות
     */
    async sendToAllCustomers(payload: PushNotificationPayload): Promise<{ success: number; failed: number }> {
        try {
            const customers = await User.find({
                role: 'customer',
                isActive: true,
                pushToken: { $exists: true, $ne: null }
            }).select('_id');

            const customerIds = customers.map(customer => String(customer._id));
            return await this.sendToMultipleUsers(customerIds, payload);

        } catch (error) {
            console.error('Error sending to all customers:', error);
            return { success: 0, failed: 0 };
        }
    }

    /**
     * הודעות ספציפיות לתורים
     */
    async sendAppointmentConfirmation(customerId: string, appointmentData: any): Promise<boolean> {
        const { barber, service, date, startTime } = appointmentData;
        const barberName = `${barber.firstName} ${barber.lastName}`;
        const serviceName = service.name;
        const appointmentDate = new Date(date).toLocaleDateString('he-IL');

        return await this.sendToUser(customerId, {
            title: 'תור נקבע בהצלחה! ✅',
            body: `התור שלך עם ${barberName} ב-${appointmentDate} בשעה ${startTime} עבור ${serviceName}`,
            data: {
                type: 'appointment_confirmation',
                appointmentId: appointmentData._id,
            }
        });
    }

    async sendAppointmentCancellation(customerId: string, appointmentData: any): Promise<boolean> {
        const { barber, service, date, startTime } = appointmentData;
        const barberName = `${barber.firstName} ${barber.lastName}`;
        const serviceName = service.name;
        const appointmentDate = new Date(date).toLocaleDateString('he-IL');

        return await this.sendToUser(customerId, {
            title: 'תור בוטל ❌',
            body: `התור שלך עם ${barberName} ב-${appointmentDate} בשעה ${startTime} עבור ${serviceName} בוטל`,
            data: {
                type: 'appointment_cancellation',
                appointmentId: appointmentData._id,
            }
        });
    }

    async sendAppointmentUpdate(customerId: string, oldAppointment: any, newAppointment: any): Promise<boolean> {
        const barberName = `${oldAppointment.barber.firstName} ${oldAppointment.barber.lastName}`;

        return await this.sendToUser(customerId, {
            title: 'תור עודכן 🔄',
            body: `התור שלך עם ${barberName} עודכן. בדוק את הפרטים החדשים`,
            data: {
                type: 'appointment_update',
                oldAppointment,
                newAppointment,
            }
        });
    }

    async sendAppointmentReminder(customerId: string, appointmentData: any): Promise<boolean> {
        const { barber, service, date, startTime } = appointmentData;
        const barberName = `${barber.firstName} ${barber.lastName}`;
        const serviceName = service.name;

        return await this.sendToUser(customerId, {
            title: 'תזכורת תור 📅',
            body: `התור שלך עם ${barberName} מחר ב-${startTime} עבור ${serviceName}`,
            data: {
                type: 'appointment_reminder',
                appointmentId: appointmentData._id,
            }
        });
    }

    async sendNewAppointmentToBarber(barberId: string, appointmentData: any): Promise<boolean> {
        const { customer, service, date, startTime } = appointmentData;
        const customerName = `${customer.firstName} ${customer.lastName}`;
        const serviceName = service.name;
        const appointmentDate = new Date(date).toLocaleDateString('he-IL');

        return await this.sendToUser(barberId, {
            title: 'תור חדש! 📅',
            body: `לקוח חדש: ${customerName} - ${serviceName} ב-${appointmentDate} בשעה ${startTime}`,
            data: {
                type: 'new_appointment',
                appointmentId: appointmentData._id,
            }
        });
    }

    /**
     * הודעות על ימי חופש
     */
    async sendBarberDayOffNotification(customerIds: string[], dayOffData: any): Promise<{ success: number; failed: number }> {
        const { date, reason } = dayOffData;
        const dayOffDate = new Date(date).toLocaleDateString('he-IL');

        return await this.sendToMultipleUsers(customerIds, {
            title: 'יום חופש של הספר 📅',
            body: `הספר יהיה בחופש ב-${dayOffDate}. ${reason ? `סיבה: ${reason}` : ''}`,
            data: {
                type: 'barber_day_off',
                dayOffId: dayOffData._id,
            }
        });
    }

    /**
     * בדיקת תקינות טוקנים וניקוי טוקנים לא תקינים
     */
    async validateAndCleanTokens(): Promise<void> {
        try {
            const users = await User.find({
                pushToken: { $exists: true, $ne: null }
            }).select('_id pushToken');

            for (const user of users) {
                if (!Expo.isExpoPushToken(user.pushToken!)) {
                    console.log(`Removing invalid token for user ${user._id}: ${user.pushToken}`);
                    await User.findByIdAndUpdate(user._id, {
                        pushToken: null,
                        platform: null
                    });
                }
            }

        } catch (error) {
            console.error('Error validating tokens:', error);
        }
    }
}

// יצירת instance יחיד
const notificationService = new NotificationService();

export default notificationService;

