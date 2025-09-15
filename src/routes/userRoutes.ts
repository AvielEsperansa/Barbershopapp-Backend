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
    getPastAppointments,
    updatePushToken,
    uploadProfileImage
} from '../controllers/userController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Simple multer configuration
const upload = multer({ storage: multer.memoryStorage() });

// Public routes
router.post('/register', upload.single('image'), register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/barbers', getBarbers);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

// Test route for debugging
router.post('/test-upload', upload.any(), (req, res) => {
    console.log('=== Test Upload Debug ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('File:', req.file);
    console.log('Files:', req.files);
    res.json({ message: 'Test upload received', files: req.files });
});

router.post('/upload-profile-image', upload.any(), uploadProfileImage);
router.get('/appointments/past', authenticateToken, getPastAppointments);
router.post('/push-token', authenticateToken, updatePushToken);

// Admin only routes - place specific routes BEFORE dynamic parameter routes
router.get('/all', authenticateToken, requireAdmin, getAllUsers);
router.patch('/status/:userId', authenticateToken, requireAdmin, toggleUserStatus);

// Dynamic parameter routes - place LAST to avoid conflicts
router.get('/:userId', authenticateToken, requireAdmin, getUserById);

export default router;
