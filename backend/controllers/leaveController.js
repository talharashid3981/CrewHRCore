import mongoose from "mongoose";
import { z } from "zod";
import attendanceModel from "../models/Attendance.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import leaveTypeModel from "../models/LeaveType.js";
import userModel from "../models/User.js";
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail } from "../utils/emailService.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import {
  addDays,
  getLeaveBalances,
  getLeavePolicy,
  getLeaveYearForDate,
  getLeaveYearRange,
  getValidation,
  getWorkingDays,
} from "../services/leaveService.js";

const requestSchema = z.object({
  leaveType: z.string(),
  from: z.string().refine(isValidCalendarDate),
  to: z.string().refine(isValidCalendarDate),
  reason: z.string().trim().max(500).optional().default(""),
  duration: z.enum(["full", "half"]).optional().default("full"),
  halfDayPeriod: z.enum(["morning", "afternoon"]).optional(),
  documentReference: z.string().trim().max(500).url().or(z.literal("")).optional(),
}).strict();
const rejectSchema = z.object({ note: z.string().trim().min(3).max(500) }).strict();
const year = (value, fallback = new Date().getFullYear()) =>
  Number.isInteger(Number(value)) && Number(value) >= 1900 && Number(value) <= 2200
    ? Number(value)
    : fallback;
const validationError = (res, parsed) =>
  res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid request data" });
const publicRequest = (request) => ({
  id: request._id,
  employee: request.employee,
  leaveType: request.leaveType,
  from: request.from,
  to: request.to,
  days: request.days,
  duration: request.duration || "full",
  halfDayPeriod: request.halfDayPeriod,
  documentReference: request.documentReference,
  reason: request.reason,
  status: request.status,
  reviewedBy: request.reviewedBy,
  reviewedAt: request.reviewedAt,
  reviewNote: request.reviewNote,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});
const idError = (res) => res.status(400).json({ success: false, message: "Invalid id" });
const populatedLeave = (query) => query
  .populate("employee", "name email department designation")
  .populate("leaveType", "name yearlyQuota isUnlimited carryForwardDays documentRequiredAfterDays minimumNoticeDays");

const resolveAdminFilter = async (req, res) => {
  const employeeQuery = { role: "employee", isActive: true };
  if (typeof req.query.department === "string" && req.query.department.trim()) {
    employeeQuery.department = req.query.department.trim().slice(0, 100);
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    employeeQuery.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { department: { $regex: escaped, $options: "i" } },
    ];
  }
  const employees = await userModel.find(employeeQuery).select("_id").lean();
  const baseFilter = { employee: { $in: employees.map((employee) => employee._id) } };
  if (req.query.employee !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(req.query.employee)) {
      res.status(400).json({ success: false, message: "Invalid employee filter" });
      return null;
    }
    if (!employees.some((employee) => String(employee._id) === String(req.query.employee))) {
      baseFilter.employee = { $in: [] };
    } else {
      baseFilter.employee = req.query.employee;
    }
  }
  const leaveTypeFilter = typeof req.query.leaveType === "string"
    ? req.query.leaveType.trim()
    : req.query.leaveType;
  if (leaveTypeFilter !== undefined && leaveTypeFilter !== "") {
    if (!mongoose.Types.ObjectId.isValid(leaveTypeFilter)) {
      res.status(400).json({ success: false, message: "Invalid leave type filter" });
      return null;
    }
    baseFilter.leaveType = leaveTypeFilter;
  }
  const filter = { ...baseFilter };
  if (["pending", "approved", "rejected", "cancelled"].includes(req.query.status)) {
    filter.status = req.query.status;
  }
  return { baseFilter, filter };
};

const adminLeaveRows = async (req, res, { paginate = true } = {}) => {
  const filters = await resolveAdminFilter(req, res);
  if (!filters) return null;
  const { baseFilter, filter } = filters;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
  const sort = req.query.sort === "soonest"
    ? { from: 1, createdAt: -1 }
    : req.query.sort === "oldest"
      ? { createdAt: 1 }
      : { createdAt: -1 };
  const query = leaveRequestModel.find(filter).sort(sort);
  if (paginate) query.skip((page - 1) * limit).limit(limit);
  const [leaves, total] = await Promise.all([
    populatedLeave(query),
    leaveRequestModel.countDocuments(filter),
  ]);
  return { baseFilter, filter, page, limit, leaves, total };
};

export const previewLeave = async (req, res) => {
  const { from, to } = req.query;
  const policy = await getLeavePolicy();
  const validation = getValidation(from, to, policy);
  if (validation) return res.status(400).json({ success: false, message: validation });
  if (req.query.leaveType) {
    if (!mongoose.Types.ObjectId.isValid(req.query.leaveType)) return idError(res);
    const type = await leaveTypeModel.findOne({ _id: req.query.leaveType, isActive: true }).select("minimumNoticeDays");
    if (!type) return res.status(404).json({ success: false, message: "Active leave type not found" });
    const today = getKarachiDateString();
    const minimumDate = addDays(today, type.minimumNoticeDays || 0);
    if (from >= today && from < minimumDate) {
      return res.status(400).json({ success: false, message: `This leave type requires ${type.minimumNoticeDays} days' notice` });
    }
  }
  const duration = req.query.duration === "half" ? "half" : "full";
  if (duration === "half" && !policy.allowHalfDay) {
    return res.status(400).json({ success: false, message: "Half-day leave is not currently allowed" });
  }
  const result = await getWorkingDays(from, to);
  if (!result.days) return res.status(400).json({ success: false, message: "The selected range contains no working days" });
  if (duration === "half" && result.days !== 1) {
    return res.status(400).json({ success: false, message: "A half-day request must contain exactly one working day" });
  }
  return res.json({
    success: true,
    from,
    to,
    days: duration === "half" ? 0.5 : result.days,
    workingDates: result.dates,
  });
};

export const getMyBalance = async (req, res) => {
  const policy = await getLeavePolicy();
  const selectedYear = year(req.query.year, getLeaveYearForDate(getKarachiDateString(), policy));
  return res.json({ success: true, year: selectedYear, balances: await getLeaveBalances(req.user._id, selectedYear) });
};

export const getEmployeeBalance = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.employeeId)) return idError(res);
  const employee = await userModel.findOne({ _id: req.params.employeeId, role: "employee" }).select("_id");
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
  const policy = await getLeavePolicy();
  const selectedYear = year(req.query.year, getLeaveYearForDate(getKarachiDateString(), policy));
  return res.json({ success: true, year: selectedYear, balances: await getLeaveBalances(employee._id, selectedYear) });
};

export const applyLeave = async (req, res) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const { leaveType, from, to, reason, duration, halfDayPeriod } = parsed.data;
    const documentReference = parsed.data.documentReference || undefined;
    const policy = await getLeavePolicy();
    const dateValidation = getValidation(from, to, policy);
    if (dateValidation) return res.status(400).json({ success: false, message: dateValidation });
    if (policy.requireReason && reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: "Please provide a reason of at least 3 characters" });
    }
    if (duration === "half" && !policy.allowHalfDay) {
      return res.status(400).json({ success: false, message: "Half-day leave is not currently allowed" });
    }
    if (duration === "half" && !halfDayPeriod) {
      return res.status(400).json({ success: false, message: "Choose the half-day period" });
    }
    if (!mongoose.Types.ObjectId.isValid(leaveType)) return idError(res);
    const type = await leaveTypeModel.findOne({ _id: leaveType, isActive: true });
    if (!type) return res.status(404).json({ success: false, message: "Active leave type not found" });
    const today = getKarachiDateString();
    const minimumDate = addDays(today, type.minimumNoticeDays || 0);
    if (from >= today && from < minimumDate) {
      return res.status(400).json({ success: false, message: `This leave type requires ${type.minimumNoticeDays} days' notice` });
    }
    const working = await getWorkingDays(from, to);
    if (!working.days) return res.status(400).json({ success: false, message: "The selected range contains no working days" });
    if (duration === "half" && working.days !== 1) {
      return res.status(400).json({ success: false, message: "A half-day request must contain exactly one working day" });
    }
    const days = duration === "half" ? 0.5 : working.days;
    if (type.documentRequiredAfterDays !== null && type.documentRequiredAfterDays !== undefined
      && working.days > type.documentRequiredAfterDays && !documentReference) {
      return res.status(400).json({
        success: false,
        message: `A supporting document link is required for requests longer than ${type.documentRequiredAfterDays} working days`,
      });
    }
    const overlap = await leaveRequestModel.exists({
      employee: req.user._id,
      status: { $in: ["pending", "approved"] },
      from: { $lte: to },
      to: { $gte: from },
    });
    if (overlap) return res.status(409).json({ success: false, message: "The leave request overlaps an existing request" });
    const hasAttendance = await attendanceModel.exists({
      employee: req.user._id,
      date: { $gte: from, $lte: to },
      checkIn: { $type: "date" },
    });
    if (hasAttendance) return res.status(409).json({ success: false, message: "Attendance is already recorded during the selected leave dates" });
    const leaveYear = getLeaveYearForDate(from, policy);
    const balances = await getLeaveBalances(req.user._id, leaveYear);
    const balance = balances.find((item) => String(item.leaveType) === String(type._id));
    if (!balance || (!balance.isUnlimited && balance.available < days)) {
      return res.status(422).json({ success: false, message: "Insufficient leave balance", available: balance?.available || 0 });
    }
    const request = await leaveRequestModel.create({
      employee: req.user._id,
      leaveType: type._id,
      from,
      to,
      days,
      duration,
      halfDayPeriod: duration === "half" ? halfDayPeriod : undefined,
      documentReference,
      reason,
    });
    return res.status(201).json({ success: true, message: "Leave request submitted", leave: publicRequest(request) });
  } catch (error) {
    console.error("Apply leave failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMyLeaves = async (req, res) => {
  const filter = { employee: req.user._id };
  if (["pending", "approved", "rejected", "cancelled"].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.year && Number.isInteger(Number(req.query.year))) {
    const policy = await getLeavePolicy();
    const range = getLeaveYearRange(Number(req.query.year), policy);
    filter.from = { $gte: range.from, $lte: range.to };
  }
  const leaves = await leaveRequestModel.find(filter).populate("leaveType", "name yearlyQuota").sort({ createdAt: -1 });
  return res.json({ success: true, leaves: leaves.map(publicRequest) });
};

export const listLeaves = async (req, res) => {
  const result = await adminLeaveRows(req, res);
  if (!result) return;
  const { baseFilter, leaves, page, limit, total } = result;
  const today = getKarachiDateString();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(today, -((weekday + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const dayStart = new Date(`${today}T00:00:00+05:00`);
  const dayEnd = new Date(`${addDays(today, 1)}T00:00:00+05:00`);
  const statuses = ["pending", "approved", "rejected", "cancelled"];
  const [counts, startsThisWeek, decidedToday, decidedTodayCount] = await Promise.all([
    Promise.all(statuses.map(async (status) => [status, await leaveRequestModel.countDocuments({ ...baseFilter, status })])),
    leaveRequestModel.countDocuments({ ...baseFilter, status: "pending", from: { $gte: weekStart, $lte: weekEnd } }),
    populatedLeave(leaveRequestModel.find({
      ...baseFilter,
      status: { $in: ["approved", "rejected"] },
      reviewedAt: { $gte: dayStart, $lt: dayEnd },
    }).sort({ reviewedAt: -1 }).limit(5)),
    leaveRequestModel.countDocuments({
      ...baseFilter,
      status: { $in: ["approved", "rejected"] },
      reviewedAt: { $gte: dayStart, $lt: dayEnd },
    }),
  ]);
  const countMap = Object.fromEntries(counts);
  return res.json({
    success: true,
    leaves: leaves.map(publicRequest),
    decidedToday: decidedToday.map(publicRequest),
    counts: { ...countMap, all: statuses.reduce((sum, key) => sum + countMap[key], 0) },
    startsThisWeek,
    decidedTodayCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getAdminLeaveDetail = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return idError(res);
  const request = await leaveRequestModel.findById(req.params.id)
    .populate("employee", "name email department designation isActive")
    .populate("leaveType", "name yearlyQuota isUnlimited carryForwardDays documentRequiredAfterDays minimumNoticeDays");
  if (!request || !request.employee?.isActive) return res.status(404).json({ success: false, message: "Leave request not found" });
  const policy = await getLeavePolicy();
  const leaveYear = getLeaveYearForDate(request.from, policy);
  const [working, balances, activeDepartmentEmployees] = await Promise.all([
    getWorkingDays(request.from, request.to),
    getLeaveBalances(request.employee._id, leaveYear),
    request.employee.department
      ? userModel.find({ role: "employee", isActive: true, department: request.employee.department }).select("_id").lean()
      : [],
  ]);
  const otherIds = activeDepartmentEmployees
    .map((employee) => employee._id)
    .filter((employeeId) => String(employeeId) !== String(request.employee._id));
  const overlappingApproved = otherIds.length
    ? await populatedLeave(leaveRequestModel.find({
      employee: { $in: otherIds },
      status: { $in: ["pending", "approved"] },
      from: { $lte: request.to },
      to: { $gte: request.from },
    }).sort({ from: 1 }))
    : [];
  const conflictEmployees = [...new Map(overlappingApproved.map((leave) => [
    String(leave.employee?._id),
    { name: leave.employee?.name, status: leave.status },
  ])).entries()].filter(([, employee]) => employee.name);
  const balance = balances.find((item) => String(item.leaveType) === String(request.leaveType?._id));
  return res.json({
    success: true,
    leave: publicRequest(request),
    workingDates: working.dates,
    workingDays: working.days,
    weekendDays: working.weekendDaysCount,
    holidayDays: working.holidayDaysCount,
    teamConflict: {
      department: request.employee.department || "the team",
      count: conflictEmployees.length,
      employees: conflictEmployees.slice(0, 3).map(([, employee]) => employee),
    },
    balance: balance || null,
    leaveYear,
  });
};

export const exportLeaveRequests = async (req, res) => {
  const result = await adminLeaveRows(req, res, { paginate: false });
  if (!result) return;
  const headers = ["Employee", "Email", "Department", "Leave type", "From", "To", "Days", "Status", "Reason", "Review note"];
  const escapeCell = (value) => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = result.leaves.map((leave) => [
    leave.employee?.name,
    leave.employee?.email,
    leave.employee?.department,
    leave.leaveType?.name,
    leave.from,
    leave.to,
    leave.days,
    leave.status,
    leave.reason,
    leave.reviewNote,
  ].map(escapeCell).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="leave-requests-${getKarachiDateString()}.csv"`);
  return res.send([headers.map(escapeCell).join(","), ...rows].join("\r\n"));
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
    if (request.duration === "half" && working.days !== 1) return res.status(422).json({ success: false, message: "Half-day requests must contain exactly one working day" });
    const policy = await getLeavePolicy();
    const leaveYear = getLeaveYearForDate(request.from, policy);
    const balances = await getLeaveBalances(request.employee._id, leaveYear);
    const balance = balances.find((item) => String(item.leaveType) === String(request.leaveType._id));
    if (!balance || (!balance.isUnlimited && balance.remaining < request.days)) return res.status(422).json({ success: false, message: "Insufficient leave balance" });
    const updated = await leaveRequestModel.findOneAndUpdate(
      { _id: request._id, status: "pending" },
      { $set: { status: "approved", days: request.duration === "half" ? 0.5 : working.days, reviewedBy: req.user._id, reviewedAt: new Date() } },
      { new: true },
    ).populate("employee", "name email").populate("leaveType", "name");
    if (!updated) return res.status(409).json({ success: false, message: "Request already processed" });
    void sendLeaveApprovedEmail(updated.employee, updated).catch((error) => console.error("Leave approval email failed:", error.message));
    return res.json({ success: true, message: "Leave approved", leave: publicRequest(updated) });
  } catch (error) {
    console.error("Approve leave failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const rejectLeave = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return idError(res);
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const request = await leaveRequestModel.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "rejected", reviewNote: parsed.data.note, reviewedBy: req.user._id, reviewedAt: new Date() } },
      { new: true },
    ).populate("employee", "name email").populate("leaveType", "name");
    if (!request) return res.status(409).json({ success: false, message: "Pending leave request not found or already processed" });
    void sendLeaveRejectedEmail(request.employee, request, parsed.data.note).catch((error) => console.error("Leave rejection email failed:", error.message));
    return res.json({ success: true, message: "Leave rejected", leave: publicRequest(request) });
  } catch (error) {
    console.error("Reject leave failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
