import { Request, Response } from 'express';
import DayOff from '../models/DayOff';
import { requireBarber } from '../middleware/auth';

// הוספת יום חופש
export async function addDayOff(req: Request, res: Response) {
    try {
        const barberId = (req as any).user?.id;
        const { date, reason, isFullDay = true, startTime, endTime } = req.body;
        console.log(date);
        if (!date) {
            return res.status(400).json({ error: 'תאריך נדרש' });
        }

        // בדיקה שהתאריך לא בעבר
        // Handle date string properly to avoid timezone issues
        const dateString = date as string;
        const [year, month, day] = dateString.split('-').map(Number);
        const selectedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)); // Use UTC to avoid timezone issues
        console.log(selectedDate);
        const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0));

        if (selectedDate < today) {
            return res.status(400).json({ error: 'לא ניתן לקבוע יום חופש לתאריכים שעברו' });
        }

        // אם זה לא יום מלא, צריך שעות התחלה וסיום
        if (!isFullDay && (!startTime || !endTime)) {
            return res.status(400).json({ error: 'שעת התחלה ושעת סיום נדרשות ליום חופש חלקי' });
        }

        // בדיקה שאין כבר יום חופש באותו תאריך
        const existingDayOff = await DayOff.findOne({
            barber: barberId,
            date: selectedDate
        });

        if (existingDayOff) {
            // אם יש כבר יום חופש מלא באותו תאריך
            if (existingDayOff.isFullDay) {
                return res.status(400).json({ error: 'קיים כבר יום חופש מלא בתאריך זה' });
            }

            // אם יש יום חופש חלקי ואנחנו מנסים להוסיף יום מלא
            if (isFullDay) {
                return res.status(400).json({ error: 'קיים כבר יום חופש חלקי בתאריך זה. לא ניתן להוסיף יום חופש מלא' });
            }

            // אם יש יום חופש חלקי ואנחנו מנסים להוסיף עוד יום חלקי - בדוק התנגשות שעות
            if (!isFullDay && existingDayOff.startTime && existingDayOff.endTime) {
                const existingStart = existingDayOff.startTime;
                const existingEnd = existingDayOff.endTime;

                // בדיקה אם יש התנגשות בשעות
                if ((startTime < existingEnd && endTime > existingStart)) {
                    return res.status(400).json({
                        error: `התנגשות שעות עם יום חופש קיים (${existingStart} - ${existingEnd}). אנא בחר שעות אחרות.`
                    });
                }
            }
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
            message: 'יום חופש נוסף בהצלחה',
            dayOff
        });

    } catch (error) {
        console.error('Add day off error:', error);
        res.status(500).json({ error: 'שגיאת שרת פנימית' });
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
        res.status(500).json({ error: 'שגיאת שרת פנימית' });
    }
}

// קבלת ימי החופש של ספר מסוים (למשתמשים)
export async function getBarberDaysOffPublic(req: Request, res: Response) {
    try {
        const { barberId, startDate, endDate } = req.query;

        if (!barberId) {
            return res.status(400).json({ error: 'מזהה ספר נדרש' });
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
        res.status(500).json({ error: 'שגיאת שרת פנימית' });
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
            return res.status(404).json({ error: 'יום חופש לא נמצא' });
        }

        res.json({ message: 'יום חופש נמחק בהצלחה' });

    } catch (error) {
        console.error('Delete day off error:', error);
        res.status(500).json({ error: 'שגיאת שרת פנימית' });
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
            return res.status(404).json({ error: 'יום חופש לא נמצא' });
        }

        // עדכון השדות
        if (reason !== undefined) dayOff.reason = reason;
        if (isFullDay !== undefined) dayOff.isFullDay = isFullDay;
        if (startTime !== undefined) dayOff.startTime = startTime;
        if (endTime !== undefined) dayOff.endTime = endTime;

        await dayOff.save();

        res.json({
            message: 'יום חופש עודכן בהצלחה',
            dayOff
        });

    } catch (error) {
        console.error('Update day off error:', error);
        res.status(500).json({ error: 'שגיאת שרת פנימית' });
    }
}
