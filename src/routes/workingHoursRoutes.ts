import { Router } from 'express';
import {
    getBarberWorkingHours,
    setBarberWorkingHours,
    getAllBarbersWorkingHours,
    updateWorkingHours,
    deleteWorkingHours
} from '../controllers/workingHoursController';
import { authenticateToken, requireBarber } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/all', getAllBarbersWorkingHours);
router.get('/barber/:barberId', getBarberWorkingHours);

// Protected routes - only barbers and admins can modify
router.post('/barber/:barberId', authenticateToken, requireBarber, setBarberWorkingHours);
router.put('/:workingHoursId', authenticateToken, requireBarber, updateWorkingHours);
router.delete('/:workingHoursId', authenticateToken, requireBarber, deleteWorkingHours);

export default router;
