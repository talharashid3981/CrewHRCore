import mongoose from "mongoose";
import { z } from "zod";
import attendanceModel from "../models/Attendance.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import leaveTypeModel from "../models/LeaveType.js";
import userModel from "../models/User.js";
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail } from "../utils/emailService.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { getLeaveBalances, getValidation, getWorkingDays } from "../services/leaveService.js";

const requestSchema = z.object({ leaveType: z.string(), from: z.string().refine(isValidCalendarDate), to: z.string().refine(isValidCalendarDate), reason: z.string().trim().min(3).max(500) }).strict();
const rejectSchema = z.object({ note: z.string().trim().min(3).max(500) }).strict();
const year = (value) => Number.isInteger(Number(value)) && Number(value) >= 1900 && Number(value) <= 2200 ? Number(value) : new Date().getFullYear();
const validationError = (res, parsed) => res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid request data" });
const publicRequest = (request) => ({ id: request._id, employee: request.employee, leaveType: request.leaveType, from: request.from, to: request.to, days: request.days, reason: request.reason, status: request.status, reviewedBy: request.reviewedBy, reviewedAt: request.reviewedAt, reviewNote: request.reviewNote, createdAt: request.createdAt, updatedAt: request.updatedAt });
const idError = (res) => res.status(400).json({ success: false, message: "Invalid id" });

export const previewLeave = async (req, res) => {
  const { from, to } = req.query;
  const validation = getValidation(from, to);
  if (validation) return res.status(400).json({ success: false, message: validation });
  const result = await getWorkingDays(from, to);
  return res.json({ success: true, from, to, days: result.days, workingDates: result.dates });
};

export const getMyBalance = async (req, res) => res.json({ success: true, year: year(req.query.year), balances: await getLeaveBalances(req.user._id, year(req.query.year)) });

export const getEmployeeBalance = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.employeeId)) return idError(res);
  const employee = await userModel.findOne({ _id: req.params.employeeId, role: "employee" }).select("_id");
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
  const selectedYear = year(req.query.year);
  return res.json({ success: true, year: selectedYear, balances: await getLeaveBalances(employee._id, selectedYear) });
};

export const applyLeave = async (req, res) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const { leaveType, from, to, reason } = parsed.data;
    const dateValidation = getValidation(from, to);
    if (dateValidation) return res.status(400).json({ success: false, message: dateValidation });
    if (!mongoose.Types.ObjectId.isValid(leaveType)) return idError(res);
    const type = await leaveTypeModel.findOne({ _id: leaveType, isActive: true });
    if (!type) return res.status(404).json({ success: false, message: "Active leave type not found" });
    const working = await getWorkingDays(from, to);
    if (!working.days) return res.status(400).json({ success: false, message: "The selected range contains no working days" });
    const overlap = await leaveRequestModel.exists({ employee: req.user._id, status: { $in: ["pending", "approved"] }, from: { $lte: to }, to: { $gte: from } });
    if (overlap) return res.status(409).json({ success: false, message: "The leave request overlaps an existing request" });
    if (from <= getKarachiDateString() && await attendanceModel.exists({ employee: req.user._id, date: getKarachiDateString() })) return res.status(409).json({ success: false, message: "Today's attendance record has already been created" });
    const balances = await getLeaveBalances(req.user._id, Number(from.slice(0, 4)));
    const balance = balances.find((item) => String(item.leaveType) === String(type._id));
    if (!balance || balance.available < working.days) return res.status(422).json({ success: false, message: "Insufficient leave balance", available: balance?.available || 0 });
    const request = await leaveRequestModel.create({ employee: req.user._id, leaveType: type._id, from, to, days: working.days, reason });
    return res.status(201).json({ success: true, message: "Leave request submitted", leave: publicRequest(request) });
  } catch (error) {
    console.error("Apply leave failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMyLeaves = async (req, res) => {
  const filter = { employee: req.user._id };
  if (["pending", "approved", "rejected", "cancelled"].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.year && Number.isInteger(Number(req.query.year))) { const selectedYear = Number(req.query.year); filter.from = { $gte: `${selectedYear}-01-01`, $lte: `${selectedYear}-12-31` }; }
  const leaves = await leaveRequestModel.find(filter).populate("leaveType", "name yearlyQuota").sort({ createdAt: -1 });
  return res.json({ success: true, leaves: leaves.map(publicRequest) });
};

export const listLeaves = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
  const activeEmployees = await userModel.find({ role: "employee", isActive: true }).select("_id").lean();
  const filter = { employee: { $in: activeEmployees.map((employee) => employee._id) } };
  if (["pending", "approved", "rejected", "cancelled"].includes(req.query.status)) filter.status = req.query.status;
  if (mongoose.Types.ObjectId.isValid(req.query.employee)) filter.employee = req.query.employee;
  const [leaves, total] = await Promise.all([leaveRequestModel.find(filter).populate("employee", "name email department").populate("leaveType", "name yearlyQuota").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), leaveRequestModel.countDocuments(filter)]);
  return res.json({ success: true, leaves: leaves.map(publicRequest), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

export const cancelLeave = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return idError(res);
  const request = await leaveRequestModel.findOne({ _id: req.params.id, employee: req.user._id });
  if (!request) return res.status(404).json({ success: false, message: "Leave request not found" });
  if (request.status === "pending") request.status = "cancelled";
  else if (request.status === "approved" && request.from > getKarachiDateString()) request.status = "cancelled";
  else return res.status(409).json({ success: false, message: "This leave request cannot be cancelled now" });
  await request.save();
  return res.json({ success: true, message: "Leave request cancelled", leave: publicRequest(request) });
};

export const approveLeave = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return idError(res);
    const request = await leaveRequestModel.findById(req.params.id).populate("employee", "name email isActive").populate("leaveType", "name yearlyQuota isActive");
    if (!request || !request.employee?.isActive) return res.status(404).json({ success: false, message: "Leave request not found" });
    if (request.status !== "pending") return res.status(409).json({ success: false, message: "Only pending requests can be approved" });
    const working = await getWorkingDays(request.from, request.to);
    if (!working.days) return res.status(422).json({ success: false, message: "Leave has no working days" });
    const balances = await getLeaveBalances(request.employee._id, Number(request.from.slice(0, 4)));
    const balance = balances.find((item) => String(item.leaveType) === String(request.leaveType._id));
    if (!balance || balance.remaining < working.days) return res.status(422).json({ success: false, message: "Insufficient leave balance" });
    const updated = await leaveRequestModel.findOneAndUpdate({ _id: request._id, status: "pending" }, { $set: { status: "approved", days: working.days, reviewedBy: req.user._id, reviewedAt: new Date() } }, { new: true }).populate("employee", "name email").populate("leaveType", "name");
    if (!updated) return res.status(409).json({ success: false, message: "Request already processed" });
    void sendLeaveApprovedEmail(updated.employee, updated).catch((error) => console.error("Leave approval email failed:", error.message));
    return res.json({ success: true, message: "Leave approved", leave: publicRequest(updated) });
  } catch (error) { console.error("Approve leave failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};

export const rejectLeave = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return idError(res);
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const request = await leaveRequestModel.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { $set: { status: "rejected", reviewNote: parsed.data.note, reviewedBy: req.user._id, reviewedAt: new Date() } }, { new: true }).populate("employee", "name email").populate("leaveType", "name");
    if (!request) return res.status(409).json({ success: false, message: "Pending leave request not found or already processed" });
    void sendLeaveRejectedEmail(request.employee, request, parsed.data.note).catch((error) => console.error("Leave rejection email failed:", error.message));
    return res.json({ success: true, message: "Leave rejected", leave: publicRequest(request) });
  } catch (error) { console.error("Reject leave failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};
