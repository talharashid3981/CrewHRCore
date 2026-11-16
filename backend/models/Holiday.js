import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },
  date: {
    type: String,
    required: true,
    unique: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
}, { timestamps: true });

export default mongoose.model("Holiday", holidaySchema);
