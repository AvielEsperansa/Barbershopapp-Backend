import { Router } from 'express';
import {
    register,
    login,
    getProfile,
    updateProfile,
    getBarbers
} from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/barbers', getBarbers);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

export default router;
