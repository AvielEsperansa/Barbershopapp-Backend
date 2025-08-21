import { Schema, model } from 'mongoose';

export interface IService {
    name: string;
    description: string;
    price: number;
    durationMinutes: number;
    category: 'haircut' | 'beard' | 'coloring' | 'styling' | 'other';
    isActive: boolean;
    imageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const serviceSchema = new Schema<IService>({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    durationMinutes: {
        type: Number,
        required: true,
        min: 5,
        max: 300
    },
    category: {
        type: String,
        enum: ['haircut', 'beard', 'coloring', 'styling', 'other'],
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    imageUrl: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ name: 1 });

export default model<IService>('Service', serviceSchema);
