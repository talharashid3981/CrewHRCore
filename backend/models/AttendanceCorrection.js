import mongoose from "mongoose";

const attendanceCorrectionSchema = new mongoose.Schema({
  attendance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendance",
    required: true,
    index: true,
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  correctedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true,
  },
  originalCheckIn: { type: Date },
  originalCheckOut: { type: Date },
  correctedCheckOut: { type: Date, required: true },
  originalWorkedMinutes: { type: Number },
  correctedWorkedMinutes: { type: Number, required: true, min: 0 },
  originalSource: { type: String, enum: ["self", "admin", "system"] },
  originalMissingCheckOut: { type: Boolean },
  reason: {
    type: String,
    enum: ["employee_forgot", "technical_issue", "manual_adjustment"],
    required: true,
  },
  note: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

attendanceCorrectionSchema.index({ date: 1, createdAt: -1 });

export default mongoose.model("AttendanceCorrection", attendanceCorrectionSchema);
