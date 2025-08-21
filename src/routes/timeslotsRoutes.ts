import { Router } from 'express';
import { list } from '../controllers/timeslotsController';
const router = Router();
router.get('/', list);
export default router;   
