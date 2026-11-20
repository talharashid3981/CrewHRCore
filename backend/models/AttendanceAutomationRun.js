import mongoose from "mongoose";

const attendanceAutomationRunSchema = new mongoose.Schema({
  source: { type: String, enum: ["scheduled", "manual"], required: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fromDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  toDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ["completed", "no_op", "failed"], required: true },
  processedDays: { type: Number, min: 0, default: 0 },
  processedRows: { type: Number, min: 0, default: 0 },
  skippedWeekends: { type: Number, min: 0, default: 0 },
  message: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });

attendanceAutomationRunSchema.index({ createdAt: -1 });

export default mongoose.model("AttendanceAutomationRun", attendanceAutomationRunSchema);
