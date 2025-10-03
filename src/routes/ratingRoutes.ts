import express from 'express';
import {
    createRating,
    updateRating,
    getRatingsByBarber,
    getRatingByAppointment,
    getUserRatings,
    getBarberRatingStats,
    getUserRateableAppointments
} from '../controllers/ratingController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /ratings - Create a new rating
router.post('/', createRating);

// PUT /ratings/:ratingId - Update an existing rating
router.put('/:ratingId', updateRating);

// GET /ratings/barber/:barberId - Get ratings for a specific barber
router.get('/barber/:barberId', getRatingsByBarber);

// GET /ratings/barber/:barberId/stats - Get rating statistics for a specific barber
router.get('/barber/:barberId/stats', getBarberRatingStats);

// GET /ratings/appointment/:appointmentId - Get rating for a specific appointment
router.get('/appointment/:appointmentId', getRatingByAppointment);

// GET /ratings/user - Get current user's ratings
router.get('/user', getUserRatings);

// GET /ratings/user/rateable-appointments - Get user's appointments that can be rated
router.get('/user/rateable-appointments', getUserRateableAppointments);

export default router;
