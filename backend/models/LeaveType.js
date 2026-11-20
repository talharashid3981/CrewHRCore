import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  nameKey: { type: String, required: true, unique: true, select: false },
  yearlyQuota: { type: Number, required: true, min: 0, max: 365, validate: Number.isInteger },
  isUnlimited: { type: Boolean, default: false },
  description: { type: String, trim: true, maxlength: 200 },
  carryForwardDays: { type: Number, min: 0, max: 365, default: 0, validate: Number.isInteger },
  documentRequiredAfterDays: { type: Number, min: 0, max: 365, default: null, validate: (value) => value === null || Number.isInteger(value) },
  minimumNoticeDays: { type: Number, min: 0, max: 365, default: 0, validate: Number.isInteger },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("LeaveType", leaveTypeSchema);
