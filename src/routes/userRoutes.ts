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
    refreshToken,
    getPastAppointments
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
router.get('/appointments/past', authenticateToken, getPastAppointments);

// Admin only routes - place specific routes BEFORE dynamic parameter routes
router.get('/all', authenticateToken, requireAdmin, getAllUsers);
router.patch('/status/:userId', authenticateToken, requireAdmin, toggleUserStatus);

// Dynamic parameter routes - place LAST to avoid conflicts
router.get('/:userId', authenticateToken, requireAdmin, getUserById);

export default router;
