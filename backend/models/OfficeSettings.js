import mongoose from "mongoose";
import { defaultShiftSchedules } from "../utils/shiftSchedules.js";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  amShiftStart: {
    type: String,
    match: timeRegex,
    default: defaultShiftSchedules.AM.shiftStart,
  },
  amShiftEnd: {
    type: String,
    match: timeRegex,
    default: defaultShiftSchedules.AM.shiftEnd,
  },
  pmShiftStart: {
    type: String,
    match: timeRegex,
    default: defaultShiftSchedules.PM.shiftStart,
  },
  pmShiftEnd: {
    type: String,
    match: timeRegex,
    default: defaultShiftSchedules.PM.shiftEnd,
  },
  weekendDays: {
    type: [Number],
    default: [0, 6],
    validate: {
      validator: (days) => days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) && new Set(days).size === days.length,
      message: "Weekend days must be unique numbers from 0 to 6",
    },
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true, optimisticConcurrency: true });

export default mongoose.model("OfficeSettings", officeSettingsSchema);
