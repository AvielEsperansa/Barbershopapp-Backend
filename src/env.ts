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
    NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validate required environment variables
if (!env.MONGO_URI) {
    console.warn('⚠️  MONGO_URI not set, using default localhost connection');
}

if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set, using default key (not secure for production)');
}
['MONGO_URI', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'].forEach(k => {
    // @ts-ignore
    if (!env[k]) throw new Error(`${k} is required`);
});