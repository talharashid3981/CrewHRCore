import mongoose from "mongoose";
import { z } from "zod";
import leaveTypeModel from "../models/LeaveType.js";

const schema = z.object({ name: z.string().trim().min(2).max(50), yearlyQuota: z.number().int().min(0).max(365), description: z.string().trim().max(200).optional(), isActive: z.boolean().optional() }).strict();
const validationError = (res, parsed) => res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid request data" });

export const listLeaveTypes = async (req, res) => {
  const filter = req.user.role === "admin" && req.query.all === "true" ? {} : { isActive: true };
  const types = await leaveTypeModel.find(filter).sort({ name: 1 });
  return res.json({ success: true, leaveTypes: types });
};

export const createLeaveType = async (req, res) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const data = { ...parsed.data, nameKey: parsed.data.name.toLowerCase() };
    const type = await leaveTypeModel.create(data);
    return res.status(201).json({ success: true, message: "Leave type created", leaveType: type });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "A leave type with this name already exists" });
    console.error("Create leave type failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateLeaveType = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid leave type id" });
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const update = { ...parsed.data };
    if (update.name !== undefined) update.nameKey = update.name.toLowerCase();
    const type = await leaveTypeModel.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!type) return res.status(404).json({ success: false, message: "Leave type not found" });
    return res.json({ success: true, message: "Leave type updated", leaveType: type });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "A leave type with this name already exists" });
    console.error("Update leave type failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
