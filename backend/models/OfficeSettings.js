import mongoose from "mongoose";

const officeSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: ["default"],
    default: "default",
    unique: true,
    immutable: true,
  },
  name: {
    type: String,
    trim: true,
    required: true,
    default: "Main Office",
    maxlength: 150,
  },
  latitude: {
    type: Number,
    min: -90,
    max: 90,
    default: null,
  },
  longitude: {
    type: Number,
    min: -180,
    max: 180,
    default: null,
  },
  radiusMeters: {
    type: Number,
    min: 20,
    max: 1000,
    default: 100,
  },
  graceMinutes: {
    type: Number,
    min: 0,
    max: 120,
    default: 15,
  },
  weekendDays: {
    type: [Number],
    default: [0, 6],
    validate: {
      validator: (days) => days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) && new Set(days).size === days.length,
      message: "Weekend days must be unique numbers from 0 to 6",
    },
  },
}, { timestamps: true });

export default mongoose.model("OfficeSettings", officeSettingsSchema);
