import { Router } from 'express';
import {
    createAppointment,
    getAvailableSlots,
    getUserAppointments,
    updateAppointmentStatus,
    cancelAppointment
} from '../controllers/appointmentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Specific routes first
router.post('/', createAppointment);
router.get('/slots', getAvailableSlots);
router.get('/my-appointments', getUserAppointments);

// Dynamic routes with more specific patterns
router.put('/status/:appointmentId', updateAppointmentStatus);
router.delete('/cancel/:appointmentId', cancelAppointment);

export default router;
