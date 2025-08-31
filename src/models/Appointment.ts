import { Schema, model, Types } from 'mongoose';

export interface IAppointment {
    customer: Types.ObjectId;
    barber: Types.ObjectId;
    service: Types.ObjectId;
    date: Date;
    startTime: string; // Format: "HH:MM"
    endTime: string;   // Format: "HH:MM"
    totalPrice: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>({
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
    service: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    date: {
        type: Date,
        required: true
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
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
appointmentSchema.index({ customer: 1, date: 1 });
appointmentSchema.index({ barber: 1, date: 1 });
appointmentSchema.index({ date: 1, startTime: 1 });

// Unique index to prevent duplicate appointments for same barber, date, and time
appointmentSchema.index(
    { barber: 1, date: 1, startTime: 1 },
    {
        unique: true
    }
);

export default model<IAppointment>('Appointment', appointmentSchema);
