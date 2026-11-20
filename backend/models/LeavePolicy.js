import mongoose from "mongoose";

const leavePolicySchema = new mongoose.Schema({
  key: { type: String, enum: ["default"], default: "default", unique: true, immutable: true },
  allowHalfDay: { type: Boolean, default: true },
  requireReason: { type: Boolean, default: true },
  allowPastDatedRequests: { type: Boolean, default: false },
  pastDatedLimitDays: { type: Number, min: 1, max: 30, default: 7 },
  leaveYearStart: {
    type: String,
    default: "01-01",
    match: /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  },
}, { timestamps: true });

export default mongoose.model("LeavePolicy", leavePolicySchema);
