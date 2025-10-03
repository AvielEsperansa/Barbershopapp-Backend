import { Schema, model, Types } from 'mongoose';

export interface IRating {
    customer: Types.ObjectId;
    barber: Types.ObjectId;
    appointment: Types.ObjectId;
    rating: number; // 1-5
    review?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ratingSchema = new Schema<IRating>({
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    barber: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    appointment: {
        type: Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    review: {
        type: String,
        trim: true,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
ratingSchema.index({ barber: 1, createdAt: -1 });
ratingSchema.index({ customer: 1, appointment: 1 });
ratingSchema.index({ appointment: 1 }, { unique: true }); // One rating per appointment

export default model<IRating>('Rating', ratingSchema);
