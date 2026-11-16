import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
  nameKey: { type: String, required: true, unique: true, select: false },
  yearlyQuota: { type: Number, required: true, min: 0, max: 365, validate: Number.isInteger },
  description: { type: String, trim: true, maxlength: 200 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("LeaveType", leaveTypeSchema);
