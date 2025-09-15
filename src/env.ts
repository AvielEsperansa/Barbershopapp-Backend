import dotenv from 'dotenv';
dotenv.config();

export const env = {
    PORT: Number(process.env.PORT || 4000),
    MONGO_URI: process.env.MONGO_URI,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET ?? '',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET ?? '',
    ACCESS_EXPIRES: process.env.ACCESS_EXPIRES ?? '15m',
    REFRESH_EXPIRES: process.env.REFRESH_EXPIRES ?? '7d',
    NODE_ENV: process.env.NODE_ENV || 'development',
    // Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? ''
};

// Validate required environment variables
if (!env.MONGO_URI) {
    console.warn('⚠️  MONGO_URI not set, using default localhost connection');
}

if (!process.env.ACCESS_TOKEN_SECRET) {
    console.warn('⚠️  JWT_SECRET not set, using default key (not secure for production)');
}

// Check Cloudinary configuration
if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    console.warn('⚠️  Cloudinary configuration missing. Image upload will not work.');
    console.warn('Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file');
}

['MONGO_URI', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'].forEach(k => {
    // @ts-ignore
    if (!env[k]) throw new Error(`${k} is required`);
});