import express from 'express';
import cors from 'cors';
import { env } from './env';
import { connectDB } from './db';
import userRoutes from './routes/userRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import serviceRoutes from './routes/servicesRoutes';
import workingHoursRoutes from './routes/workingHoursRoutes';

async function main() {
    try {
        // Connect to MongoDB
        await connectDB();
        console.log('✅ Connected to MongoDB');

        const app = express();

        // Middleware
        app.use(cors({
            origin: env.CLIENT_ORIGIN,
            credentials: true
        }));
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true }));

        // Health check
        app.get('/health', (_req, res) => res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            database: 'Connected'
        }));

        // API Routes
        app.use('/users', userRoutes);
        app.use('/appointments', appointmentRoutes);
        app.use('/services', serviceRoutes);
        app.use('/working-hours', workingHoursRoutes);

        // 404 handler
        app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Route not found',
                path: req.originalUrl
            });
        });

        // Global error handler
        app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            console.error('Global error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });

        // Start server (bind to 0.0.0.0 to allow LAN devices like phones to connect)
        app.listen(env.PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${env.PORT} (listening on 0.0.0.0)`);
            console.log(`🔍 Health check (local)  -> http://localhost:${env.PORT}/health`);
            console.log(`📱 Health check (from phone): use http://<your-computer-LAN-IP>:${env.PORT}/health`);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

main();
