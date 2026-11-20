import mongoose from "mongoose";
import { z } from "zod";
import leaveTypeModel from "../models/LeaveType.js";
import leavePolicyModel from "../models/LeavePolicy.js";
import { DEFAULT_LEAVE_POLICY, getLeavePolicy, isUnlimitedLeaveType } from "../services/leaveService.js";

const schema = z.object({
  name: z.string().trim().min(2).max(50),
  yearlyQuota: z.number().int().min(0).max(365),
  isUnlimited: z.boolean().optional(),
  description: z.string().trim().max(200).optional(),
  carryForwardDays: z.number().int().min(0).max(365).optional(),
  documentRequiredAfterDays: z.number().int().min(0).max(365).nullable().optional(),
  minimumNoticeDays: z.number().int().min(0).max(365).optional(),
  isActive: z.boolean().optional(),
}).strict();
const policySchema = z.object({
  allowHalfDay: z.boolean(),
  requireReason: z.boolean(),
  allowPastDatedRequests: z.boolean(),
  pastDatedLimitDays: z.number().int().min(1).max(30),
  leaveYearStart: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Leave year start must use MM-DD format"),
}).strict().superRefine((policy, context) => {
  const [month, day] = policy.leaveYearStart.split("-").map(Number);
  const maxDay = new Date(Date.UTC(2000, month, 0)).getUTCDate();
  if (day > maxDay) context.addIssue({ code: "custom", path: ["leaveYearStart"], message: "Leave year start must be a valid calendar date" });
});
const validationError = (res, parsed) => res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid request data" });

export const listLeaveTypes = async (req, res) => {
  const filter = req.user.role === "admin" && req.query.all === "true" ? {} : { isActive: true };
  const types = await leaveTypeModel.find(filter).sort({ name: 1 });
  return res.json({
    success: true,
    leaveTypes: types.map((type) => ({
      ...type.toObject(),
      isUnlimited: isUnlimitedLeaveType(type),
    })),
  });
};

export const getLeavePolicySettings = async (req, res) => {
  const policy = await getLeavePolicy();
  return res.json({ success: true, policy });
};

export const updateLeavePolicySettings = async (req, res) => {
  try {
    const parsed = policySchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const policy = await leavePolicyModel.findOneAndUpdate(
      { key: "default" },
      { $set: parsed.data, $setOnInsert: { key: "default" } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.json({ success: true, message: "Leave policy saved", policy: { ...DEFAULT_LEAVE_POLICY, ...policy.toObject() } });
  } catch (error) {
    console.error("Update leave policy failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createLeaveType = async (req, res) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const data = { ...parsed.data, nameKey: parsed.data.name.toLowerCase() };
    data.isUnlimited = isUnlimitedLeaveType(data);
    if (data.isUnlimited) data.yearlyQuota = 0;
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
    const currentType = await leaveTypeModel.findById(req.params.id);
    if (!currentType) return res.status(404).json({ success: false, message: "Leave type not found" });
    const nextType = { ...currentType.toObject(), ...update };
    update.isUnlimited = isUnlimitedLeaveType(nextType);
    if (update.isUnlimited) update.yearlyQuota = 0;
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
