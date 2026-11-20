import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  distance: { type: Number, required: true, min: 0 },
  accuracy: { type: Number, required: true, min: 0 },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  checkIn: { type: Date },
  checkOut: { type: Date },
  status: {
    type: String,
    enum: ["present", "late", "absent", "leave", "holiday"],
    required: true,
  },
  source: {
    type: String,
    enum: ["self", "admin", "system"],
    default: "self",
    index: true,
  },
  missingCheckOut: { type: Boolean, default: false },
  lateMinutes: { type: Number, min: 0, default: 0 },
  leaveDays: { type: Number, min: 0, max: 1, default: 0 },
  leavePeriod: { type: String, enum: ["morning", "afternoon"] },
  checkInLocation: { type: locationSchema },
  checkOutLocation: { type: locationSchema },
  workedMinutes: { type: Number, min: 0 },
}, { timestamps: true });

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });

export default mongoose.model("Attendance", attendanceSchema);
