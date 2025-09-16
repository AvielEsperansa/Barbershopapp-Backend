import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { env } from '../env';

// Ensure .env is loaded even if this file is imported very early
dotenv.config();

if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    // Provide a clear startup error to avoid silent misconfigurations
    throw new Error(
        'Cloudinary env vars are missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env'
    );
}

cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
});

export default cloudinary;
