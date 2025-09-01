import { Request, Response } from 'express';
import DayOff from '../models/DayOff';
import { requireBarber } from '../middleware/auth';

// הוספת יום חופש
export async function addDayOff(req: Request, res: Response) {
    try {
        const barberId = (req as any).user?.id;
        const { date, reason, isFullDay = true, startTime, endTime } = req.body;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        // בדיקה שהתאריך לא בעבר
        const selectedDate = new Date(date as string);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            return res.status(400).json({ error: 'Cannot set day off for past dates' });
        }

        // אם זה לא יום מלא, צריך שעות התחלה וסיום
        if (!isFullDay && (!startTime || !endTime)) {
            return res.status(400).json({ error: 'Start time and end time are required for partial day off' });
        }

        // בדיקה שאין כבר יום חופש באותו תאריך
        const existingDayOff = await DayOff.findOne({
            barber: barberId,
            date: selectedDate
        });

        if (existingDayOff) {
            return res.status(400).json({ error: 'Day off already exists for this date' });
        }

        const dayOff = new DayOff({
            barber: barberId,
            date: selectedDate,
            reason,
            isFullDay,
            startTime: isFullDay ? undefined : startTime,
            endTime: isFullDay ? undefined : endTime
        });

        await dayOff.save();

        res.status(201).json({
            message: 'Day off added successfully',
            dayOff
        });

    } catch (error) {
        console.error('Add day off error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// קבלת כל ימי החופש של הספר
export async function getBarberDaysOff(req: Request, res: Response) {
    try {
        const barberId = (req as any).user?.id;
        const { startDate, endDate } = req.query;

        let filter: any = { barber: barberId };

        // אם יש טווח תאריכים
        if (startDate && endDate) {
            filter.date = {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string)
            };
        }

        const daysOff = await DayOff.find(filter).sort({ date: 1 });

        res.json({ daysOff });

    } catch (error) {
        console.error('Get days off error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// קבלת ימי החופש של ספר מסוים (למשתמשים)
export async function getBarberDaysOffPublic(req: Request, res: Response) {
    try {
        const { barberId, startDate, endDate } = req.query;

        if (!barberId) {
            return res.status(400).json({ error: 'Barber ID is required' });
        }

        let filter: any = { barber: barberId };

        // אם יש טווח תאריכים
        if (startDate && endDate) {
            filter.date = {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string)
            };
        } else {
            // אם אין טווח, מחזיר רק ימי חופש עתידיים
            filter.date = { $gte: new Date() };
        }

        const daysOff = await DayOff.find(filter)
            .select('date reason isFullDay startTime endTime')
            .sort({ date: 1 });

        res.json({ daysOff });

    } catch (error) {
        console.error('Get public days off error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// מחיקת יום חופש
export async function deleteDayOff(req: Request, res: Response) {
    try {
        const barberId = (req as any).user?.id;
        const { dayOffId } = req.params;

        const dayOff = await DayOff.findOneAndDelete({
            _id: dayOffId,
            barber: barberId
        });

        if (!dayOff) {
            return res.status(404).json({ error: 'Day off not found' });
        }

        res.json({ message: 'Day off deleted successfully' });

    } catch (error) {
        console.error('Delete day off error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// עדכון יום חופש
export async function updateDayOff(req: Request, res: Response) {
    try {
        const barberId = (req as any).user?.id;
        const { dayOffId } = req.params;
        const { reason, isFullDay, startTime, endTime } = req.body;

        const dayOff = await DayOff.findOne({
            _id: dayOffId,
            barber: barberId
        });

        if (!dayOff) {
            return res.status(404).json({ error: 'Day off not found' });
        }

        // עדכון השדות
        if (reason !== undefined) dayOff.reason = reason;
        if (isFullDay !== undefined) dayOff.isFullDay = isFullDay;
        if (startTime !== undefined) dayOff.startTime = startTime;
        if (endTime !== undefined) dayOff.endTime = endTime;

        await dayOff.save();

        res.json({
            message: 'Day off updated successfully',
            dayOff
        });

    } catch (error) {
        console.error('Update day off error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
