import { Router } from 'express';
import {
    register,
    login,
    getProfile,
    updateProfile,
    getBarbers,
    getUserById,
    getAllUsers,
    toggleUserStatus
} from '../controllers/userController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/barbers', getBarbers);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

// Admin only routes
router.get('/all', authenticateToken, requireAdmin, getAllUsers);
router.get('/:userId', authenticateToken, requireAdmin, getUserById);
router.patch('/:userId/status', authenticateToken, requireAdmin, toggleUserStatus);

export default router;
