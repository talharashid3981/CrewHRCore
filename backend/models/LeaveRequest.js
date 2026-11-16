import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
  from: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  to: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  days: { type: Number, required: true, min: 1, validate: Number.isInteger },
  reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
  status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reviewedAt: { type: Date },
  reviewNote: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

leaveRequestSchema.index({ employee: 1, status: 1 });
leaveRequestSchema.index({ employee: 1, from: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
