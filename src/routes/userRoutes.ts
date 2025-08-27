import { Router } from 'express';
import multer from 'multer';
import {
    register,
    login,
    getProfile,
    updateProfile,
    getBarbers,
    getUserById,
    getAllUsers,
    toggleUserStatus,
    refreshToken
} from '../controllers/userController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public routes
router.post('/register', upload.single('image'), register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/barbers', getBarbers);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

// Admin only routes
router.get('/all', authenticateToken, requireAdmin, getAllUsers);
router.get('/:userId', authenticateToken, requireAdmin, getUserById);
router.patch('/:userId/status', authenticateToken, requireAdmin, toggleUserStatus);

export default router;
