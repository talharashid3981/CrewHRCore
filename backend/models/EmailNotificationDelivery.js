import mongoose from "mongoose";

const emailNotificationDeliverySchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  kind: {
    type: String,
    enum: ["check-in-reminder", "check-out-reminder", "weekly-summary"],
    required: true,
  },
  periodKey: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["sending", "sent", "failed"],
    required: true,
    default: "sending",
  },
  leaseExpiresAt: {
    type: Date,
    required: true,
  },
  sentAt: Date,
  lastError: {
    type: String,
    maxlength: 500,
  },
}, { timestamps: true });

emailNotificationDeliverySchema.index(
  { employee: 1, kind: 1, periodKey: 1 },
  { unique: true },
);
emailNotificationDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("EmailNotificationDelivery", emailNotificationDeliverySchema);
