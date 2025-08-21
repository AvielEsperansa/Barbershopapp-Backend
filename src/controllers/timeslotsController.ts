import { Request, Response } from 'express';

export async function list(req: Request, res: Response) {
    const { date } = req.query as { date?: string };
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const day = new Date(date + 'T00:00:00');
    const slots: any[] = [];
    for (let h = 10; h < 18; h++) {
        for (const m of [0, 30]) {
            const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
            const end = new Date(start.getTime() + 30 * 60000);
            slots.push({ _id: `${h}:${m}`, start, end });
        }
    }
    res.json(slots);
}
