import { Router } from 'express';
import {
    sendAppointmentReminders,
    sendRatingReminders,
    sendCustomNotification,
    sendNotificationToAllBarbers,
    sendNotificationToAllCustomers,
    validateAndCleanTokens
} from '../controllers/notificationController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Admin only routes
router.post('/reminders', authenticateToken, requireAdmin, sendAppointmentReminders);
router.post('/rating-reminders', authenticateToken, requireAdmin, sendRatingReminders);
router.post('/custom', authenticateToken, requireAdmin, sendCustomNotification);
router.post('/barbers', authenticateToken, requireAdmin, sendNotificationToAllBarbers);
router.post('/customers', authenticateToken, requireAdmin, sendNotificationToAllCustomers);
router.post('/cleanup-tokens', authenticateToken, requireAdmin, validateAndCleanTokens);

export default router;

