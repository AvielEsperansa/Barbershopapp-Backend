import express from 'express';
import { authenticateToken, requireBarber } from '../middleware/auth';
import {
    addDayOff,
    getBarberDaysOff,
    deleteDayOff,
    updateDayOff,
    getBarberDaysOffPublic
} from '../controllers/dayOffController';

const router = express.Router();

// נתיב ציבורי - לא דורש אימות (למשתמשים)
router.get('/public/:barberId', getBarberDaysOffPublic);

// כל הנתיבים הבאים דורשים אימות והרשאות של ספר
router.use(authenticateToken, requireBarber);

// הוספת יום חופש
router.post('/', addDayOff);

// קבלת ימי החופש של הספר
router.get('/', getBarberDaysOff);

// עדכון יום חופש
router.put('/:dayOffId', updateDayOff);

// מחיקת יום חופש
router.delete('/:dayOffId', deleteDayOff);

export default router;
