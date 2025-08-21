import { Request, Response } from 'express';
import Service from '../models/Service';

// Get all services
export async function list(_req: Request, res: Response) {
    try {
        const services = await Service.find({ isActive: true }).sort({ category: 1, name: 1 });

        // If no services exist, create default ones
        if (services.length === 0) {
            const defaultServices = [
                {
                    name: 'תספורת גבר',
                    description: 'תספורת מקצועית לגברים כולל עיצוב וסידור',
                    price: 80,
                    durationMinutes: 30,
                    category: 'haircut'
                },
                {
                    name: 'זקן ועיצוב',
                    description: 'עיצוב וטיפוח הזקן עם כלים מקצועיים',
                    price: 50,
                    durationMinutes: 20,
                    category: 'beard'
                },
                {
                    name: 'צבע לשיער',
                    description: 'צביעת שיער מקצועית עם חומרים איכותיים',
                    price: 150,
                    durationMinutes: 45,
                    category: 'coloring'
                },
                {
                    name: 'תספורת ילדים',
                    description: 'תספורת מותאמת לילדים עם סבלנות רבה',
                    price: 60,
                    durationMinutes: 25,
                    category: 'haircut'
                }
            ];

            await Service.insertMany(defaultServices);
            const newServices = await Service.find({ isActive: true });
            return res.json({ services: newServices, message: 'Default services created' });
        }

        res.json({ services });
    } catch (error) {
        console.error('List services error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get service by ID
export async function getById(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const service = await Service.findById(id);

        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json({ service });
    } catch (error) {
        console.error('Get service error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Create new service (admin only)
export async function create(req: Request, res: Response) {
    try {
        const { name, description, price, durationMinutes, category, imageUrl } = req.body;

        const service = new Service({
            name,
            description,
            price,
            durationMinutes,
            category,
            imageUrl
        });

        await service.save();
        res.status(201).json({
            message: 'Service created successfully',
            service
        });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Update service (admin only)
export async function update(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const service = await Service.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json({
            message: 'Service updated successfully',
            service
        });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Delete service (admin only)
export async function remove(req: Request, res: Response) {
    try {
        const { id } = req.params;

        // Soft delete - just mark as inactive
        const service = await Service.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json({
            message: 'Service deleted successfully',
            service
        });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
