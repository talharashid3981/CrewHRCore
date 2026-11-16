import mongoose from "mongoose";

const automationStateSchema = new mongoose.Schema({
  key: { type: String, enum: ["dailyClose"], unique: true, immutable: true },
  lastProcessedDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
}, { timestamps: true });

export default mongoose.model("AutomationState", automationStateSchema);
