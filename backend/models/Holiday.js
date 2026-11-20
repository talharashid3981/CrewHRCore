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
  to: {
    type: String,
    match: /^\d{4}-\d{2}-\d{2}$/,
    validate: {
      validator(value) {
        return !value || value >= this.date;
      },
      message: "Holiday end date must not be before its start date",
    },
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
}, { timestamps: true });

export default mongoose.model("Holiday", holidaySchema);
