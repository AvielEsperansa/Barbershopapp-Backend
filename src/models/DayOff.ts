import mongoose, { Schema, Document } from 'mongoose';

export interface IDayOff extends Document {
    barber: mongoose.Types.ObjectId;
    date: Date;
    reason?: string;
    isFullDay: boolean;
    startTime?: string; // אם זה לא יום מלא
    endTime?: string;   // אם זה לא יום מלא
    createdAt: Date;
    updatedAt: Date;
}

const dayOffSchema = new Schema<IDayOff>({
    barber: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        trim: true
    },
    isFullDay: {
        type: Boolean,
        default: true
    },
    startTime: {
        type: String,
        validate: {
            validator: function (v: string) {
                if (!this.isFullDay && !v) return false;
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Start time must be in HH:MM format'
        }
    },
    endTime: {
        type: String,
        validate: {
            validator: function (v: string) {
                if (!this.isFullDay && !v) return false;
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'End time must be in HH:MM format'
        }
    }
}, {
    timestamps: true
});

// אינדקס ייחודי - ספר לא יכול להיות בחופש באותו תאריך
dayOffSchema.index({ barber: 1, date: 1 }, { unique: true });

// אינדקס לתאריכים עתידיים
dayOffSchema.index({ date: 1 });

export default mongoose.model<IDayOff>('DayOff', dayOffSchema);
