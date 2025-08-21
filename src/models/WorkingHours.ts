import { Schema, model, Types } from 'mongoose';

export interface IWorkingHours {
    barber: Types.ObjectId;
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
    startTime: string; // Format: "HH:MM"
    endTime: string;   // Format: "HH:MM"
    isWorking: boolean;
    breakStartTime?: string;
    breakEndTime?: string;
    createdAt: Date;
    updatedAt: Date;
}

const workingHoursSchema = new Schema<IWorkingHours>({
    barber: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    dayOfWeek: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },
    startTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    isWorking: {
        type: Boolean,
        default: true
    },
    breakStartTime: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    breakEndTime: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
workingHoursSchema.index({ barber: 1, dayOfWeek: 1 }, { unique: true });

export default model<IWorkingHours>('WorkingHours', workingHoursSchema);
