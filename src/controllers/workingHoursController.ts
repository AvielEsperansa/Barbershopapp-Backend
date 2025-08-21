import { Request, Response } from 'express';
import WorkingHours from '../models/WorkingHours';
import User from '../models/User';

// Get working hours for a specific barber
export async function getBarberWorkingHours(req: Request, res: Response) {
    try {
        const { barberId } = req.params;

        // Check if barber exists
        const barber = await User.findById(barberId);
        if (!barber || barber.role !== 'barber') {
            return res.status(404).json({ error: 'Barber not found' });
        }

        // Get all working hours for this barber
        const workingHours = await WorkingHours.find({
            barber: barberId
        }).sort({ dayOfWeek: 1 });

        res.json({ workingHours, barber: { firstName: barber.firstName, lastName: barber.lastName } });
    } catch (error) {
        console.error('Get working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Set working hours for a barber
export async function setBarberWorkingHours(req: Request, res: Response) {
    try {
        const { barberId } = req.params;
        const { workingHours } = req.body;

        // Check if barber exists
        const barber = await User.findById(barberId);
        if (!barber || barber.role !== 'barber') {
            return res.status(404).json({ error: 'Barber not found' });
        }

        // Validate working hours data
        if (!Array.isArray(workingHours)) {
            return res.status(400).json({ error: 'Working hours must be an array' });
        }

        // Delete existing working hours for this barber
        await WorkingHours.deleteMany({ barber: barberId });

        // Create new working hours
        const workingHoursData = workingHours.map((wh: any) => ({
            barber: barberId,
            dayOfWeek: wh.dayOfWeek,
            startTime: wh.startTime,
            endTime: wh.endTime,
            isWorking: wh.isWorking,
            breakStartTime: wh.breakStartTime,
            breakEndTime: wh.breakEndTime
        }));

        const newWorkingHours = await WorkingHours.insertMany(workingHoursData);

        res.json({
            message: 'Working hours updated successfully',
            workingHours: newWorkingHours
        });

    } catch (error) {
        console.error('Set working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get working hours for all barbers
export async function getAllBarbersWorkingHours(req: Request, res: Response) {
    try {
        // Get all barbers
        const barbers = await User.find({ role: 'barber', isActive: true });

        // Get working hours for each barber
        const barbersWithHours = await Promise.all(
            barbers.map(async (barber) => {
                const workingHours = await WorkingHours.find({
                    barber: barber._id
                }).sort({ dayOfWeek: 1 });

                return {
                    barber: {
                        _id: barber._id,
                        firstName: barber.firstName,
                        lastName: barber.lastName
                    },
                    workingHours
                };
            })
        );

        res.json({ barbers: barbersWithHours });
    } catch (error) {
        console.error('Get all barbers working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Update specific working hours
export async function updateWorkingHours(req: Request, res: Response) {
    try {
        const { workingHoursId } = req.params;
        const updateData = req.body;

        const workingHours = await WorkingHours.findByIdAndUpdate(
            workingHoursId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!workingHours) {
            return res.status(404).json({ error: 'Working hours not found' });
        }

        res.json({
            message: 'Working hours updated successfully',
            workingHours
        });

    } catch (error) {
        console.error('Update working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Delete working hours
export async function deleteWorkingHours(req: Request, res: Response) {
    try {
        const { workingHoursId } = req.params;

        const workingHours = await WorkingHours.findByIdAndDelete(workingHoursId);

        if (!workingHours) {
            return res.status(404).json({ error: 'Working hours not found' });
        }

        res.json({
            message: 'Working hours deleted successfully',
            workingHours
        });

    } catch (error) {
        console.error('Delete working hours error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
