import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: 'customer' | 'barber' | 'admin';
    profileImageData?: {
        url: string | null;
        publicId: string | null;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    refreshTokens: string[]; // אחד לכל מכשיר/דפדפן
    pushToken?: string; // Expo push token
    platform?: 'ios' | 'android'; // פלטפורמת המכשיר

}

const userSchema = new Schema<IUser>({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    refreshTokens: { type: [String], default: [] },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['customer', 'barber', 'admin'],
        default: 'customer'
    },
    profileImageData: {
        url: { type: String, default: null },
        publicId: { type: String, default: null }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    pushToken: {
        type: String,
        default: null
    },
    platform: {
        type: String,
        enum: ['ios', 'android'],
        default: null
    }
}, {
    timestamps: true
});

// Index for faster queries - email already has unique index from schema
userSchema.index({ role: 1 });
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
});

export default model<IUser>('User', userSchema);
