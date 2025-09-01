import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    createAppointment,
    getAvailableSlots,
    getUserAppointments,
    cancelAppointment,
    getBarberAppointmentHistory,
    getBarberAppointmentStats,
    getBarberCompletedAppointments
} from '../controllers/appointmentController';

const router = express.Router();
// Public routes (no authentication required)
router.get('/slots', getAvailableSlots);

// Protected routes (authentication required)
router.use(authenticateToken);

// User routes
router.post('/', createAppointment);
router.get('/', getUserAppointments);
router.delete('/:appointmentId', cancelAppointment);

// Barber routes (public - no authentication required for viewing barber data)
router.get('/barber/:barberId/history', getBarberAppointmentHistory);
router.get('/barber/:barberId/stats', getBarberAppointmentStats);
router.get('/barber/:barberId/completed', getBarberCompletedAppointments);

export default router;
