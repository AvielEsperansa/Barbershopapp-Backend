import { Router } from 'express';
import {
    list,
    getById,
    create,
    update,
    remove
} from '../controllers/servicesController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', list);

// Admin only routes
router.post('/', authenticateToken, requireAdmin, create);

// Dynamic routes - use more specific patterns
router.get('/service/:id', getById);
router.put('/service/:id', authenticateToken, requireAdmin, update);
router.delete('/service/:id', authenticateToken, requireAdmin, remove);

export default router;
