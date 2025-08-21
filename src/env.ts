import dotenv from 'dotenv';
dotenv.config();

export const env = {
    PORT: Number(process.env.PORT || 4000),
    MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/barbershop',
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validate required environment variables
if (!env.MONGO_URI) {
    console.warn('⚠️  MONGO_URI not set, using default localhost connection');
}

if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set, using default key (not secure for production)');
}
