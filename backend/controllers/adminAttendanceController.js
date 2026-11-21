import { z } from "zod";
import attendanceModel from "../models/Attendance.js";
import attendanceAutomationRunModel from "../models/AttendanceAutomationRun.js";
import attendanceCorrectionModel from "../models/AttendanceCorrection.js";
import automationStateModel from "../models/AutomationState.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import officeSettingsModel from "../models/OfficeSettings.js";
import userModel from "../models/User.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { getResolutionContext, resolveRangeBulk } from "../services/automationService.js";
import { addDays } from "../services/leaveService.js";

const statusValues = ["present", "late", "absent", "leave", "holiday", "weekend", "pending"];
const objectIdPattern = /^[a-f\d]{24}$/i;
const correctionSchema = z.object({
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reason: z.enum(["employee_forgot", "technical_issue", "manual_adjustment"]),
  note: z.string().trim().max(500).optional().default(""),
}).strict();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getDayData = async (date) => {
  const yesterday = addDays(date, -1);
  const sevenDaysAgo = addDays(date, -7);
  const dayEnd = new Date(`${addDays(date, 1)}T00:00:00+05:00`);
  const employees = await userModel.find({
    role: "employee",
    isActive: true,
    onboardingStatus: "approved",
  }).select("_id name email department shiftStart shiftEnd joiningDate approvedAt").sort({ name: 1 }).lean();
  const [resolved, context, settings, automation, missingCheckOuts, openMissingCheckOutCount, yesterdayMissingCheckOutCount, olderMissingCheckOutCount, corrections, automationRuns, approvedLeaves] = await Promise.all([
    resolveRangeBulk(employees, date, date),
    getResolutionContext(date, date),
    officeSettingsModel.findOne({ key: "default" }).select("weekendDays graceMinutes radiusMeters").lean(),
    automationStateModel.findOne({ key: "dailyClose" }).select("lastProcessedDate updatedAt").lean(),
    attendanceModel.find({
      date: { $gte: sevenDaysAgo, $lte: yesterday },
      missingCheckOut: true,
      checkOut: { $exists: false },
    }).populate("employee", "name email department").sort({ date: -1 }).limit(50).lean(),
    attendanceModel.countDocuments({
      date: { $gte: sevenDaysAgo, $lte: yesterday },
      missingCheckOut: true,
      checkOut: { $exists: false },
    }),
    attendanceModel.countDocuments({
      date: yesterday,
      missingCheckOut: true,
      checkOut: { $exists: false },
    }),
    attendanceModel.countDocuments({
      date: { $gte: sevenDaysAgo, $lte: addDays(date, -2) },
      missingCheckOut: true,
      checkOut: { $exists: false },
    }),
    attendanceCorrectionModel.find({
      date: { $gte: addDays(date, -6), $lte: date },
      createdAt: { $lt: dayEnd },
    }).populate("employee", "name").populate("correctedBy", "name").sort({ createdAt: -1 }).limit(10).lean(),
    attendanceAutomationRunModel.find({ createdAt: { $gte: new Date(`${sevenDaysAgo}T00:00:00+05:00`), $lt: dayEnd } })
      .populate("initiatedBy", "name").sort({ createdAt: -1 }).limit(10).lean(),
    employees.length ? leaveRequestModel.find({
      employee: { $in: employees.map((employee) => employee._id) },
      status: "approved",
      from: { $lte: date },
      to: { $gte: date },
    }).populate("leaveType", "name").select("employee leaveType duration halfDayPeriod days").lean() : [],
  ]);
  const leaveTypeByEmployee = new Map(approvedLeaves.map((leave) => [String(leave.employee), {
    name: leave.leaveType?.name || "Approved leave",
    days: leave.duration === "half" ? 0.5 : 1,
    period: leave.halfDayPeriod || null,
  }]));
  const rows = employees.map((employee) => {
    const day = resolved.get(String(employee._id))?.[0];
    return day?.status === "notEligible" ? null : {
      employee,
      day,
      approvedLeave: leaveTypeByEmployee.get(String(employee._id)) || null,
    };
  }).filter(Boolean);
  const count = (status) => rows.filter(({ day }) => day.status === status).length;
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekend = (settings?.weekendDays || [0, 6]).includes(dayOfWeek);
  const holiday = context.holidays.has(date);
  const updatedAt = rows.reduce((latest, { day }) => {
    const value = day.attendance?.updatedAt;
    return value && (!latest || value > latest) ? value : latest;
  }, null);
  const latestRun = automationRuns[0];
  const automationStatus = automation || latestRun ? {
    lastProcessedDate: automation?.lastProcessedDate || null,
    lastRunAt: latestRun?.createdAt || automation?.updatedAt || null,
    isHealthy: Boolean(automation?.lastProcessedDate >= addDays(getKarachiDateString(), -1) && latestRun?.status !== "failed"),
  } : null;

  return {
    rows,
    summary: {
      totalEmployees: rows.length,
      present: count("present"),
      late: count("late"),
      absent: count("absent"),
      leave: count("leave"),
      holiday: count("holiday"),
      weekend: weekend ? rows.length : 0,
      pending: count("pending"),
      notCheckedIn: count("absent") + count("pending"),
      checkedIn: count("present") + count("late"),
      openMissingCheckOutCount,
      yesterdayMissingCheckOutCount,
      olderMissingCheckOutCount,
      dayType: weekend ? "weekend" : holiday ? "holiday" : "working",
      updatedAt,
    },
    settings: { graceMinutes: settings?.graceMinutes ?? 15, weekendDays: settings?.weekendDays || [0, 6], radiusMeters: settings?.radiusMeters ?? 100 },
    automation: automationStatus,
    missingCheckOuts: missingCheckOuts.map((record) => ({
      attendanceId: record._id,
      employee: record.employee,
      date: record.date,
      checkIn: record.checkIn,
    })),
    activities: [
      ...corrections.map((record) => ({
        id: `correction-${record._id}`,
        type: "correction",
        employee: record.employee?.name || "Employee",
        actor: record.correctedBy?.name || "Administrator",
        date: record.date,
        correctedCheckOut: record.correctedCheckOut,
        reason: record.reason,
        note: record.note || "",
        createdAt: record.createdAt,
      })),
      ...automationRuns.map((record) => ({
        id: `automation-${record._id}`,
        type: "automation",
        actor: record.initiatedBy?.name || (record.source === "scheduled" ? "Scheduled automation" : "Administrator"),
        date: record.toDate || date,
        fromDate: record.fromDate || null,
        status: record.status,
        source: record.source,
        processedDays: record.processedDays,
        processedRows: record.processedRows,
        message: record.message || "",
        createdAt: record.createdAt,
      })),
    ].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)).slice(0, 8),
  };
};

const filterRows = (rows, query) => {
  const search = String(query.search || "").trim().slice(0, 100);
  const matcher = search ? new RegExp(escapeRegex(search), "i") : null;
  return rows.filter(({ employee, day }) => {
    if (query.status && day.status !== query.status) return false;
    if (query.department && employee.department !== query.department) return false;
    if (matcher && !matcher.test(employee.name) && !matcher.test(employee.email)) return false;
    return true;
  });
};

export const getAdminAttendanceDay = async (req, res) => {
  const date = req.query.date || getKarachiDateString();
  if (!isValidCalendarDate(date)) return res.status(400).json({ success: false, message: "date must be a valid YYYY-MM-DD date" });
  if (date > getKarachiDateString()) return res.status(400).json({ success: false, message: "Future attendance dates are not available" });
  if (req.query.status && !statusValues.includes(req.query.status)) return res.status(400).json({ success: false, message: "Invalid attendance status" });

  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 8);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ success: false, message: "page and limit must be valid positive integers (limit max 50)" });
  }
  try {
    const data = await getDayData(date);
    const filteredRows = filterRows(data.rows, req.query);
    const pages = Math.ceil(filteredRows.length / limit);
    const items = filteredRows.slice((page - 1) * limit, page * limit).map(({ employee, day, approvedLeave }) => ({
      attendanceId: day.attendance?._id || null,
      employee: { id: employee._id, name: employee.name, email: employee.email },
      department: employee.department || null,
      shiftStart: employee.shiftStart || null,
      shiftEnd: employee.shiftEnd || null,
      status: day.status,
      checkIn: day.attendance?.checkIn || null,
      checkOut: day.attendance?.checkOut || null,
      workedMinutes: day.attendance?.workedMinutes ?? null,
      lateMinutes: day.attendance?.lateMinutes || 0,
      missingCheckOut: Boolean(day.attendance?.missingCheckOut),
      source: day.attendance?.source || null,
      leaveType: approvedLeave?.name || null,
      leaveDays: day.attendance?.leaveDays || approvedLeave?.days || 0,
      leavePeriod: day.attendance?.leavePeriod || approvedLeave?.period || null,
    }));
    return res.json({
      success: true,
      date,
      summary: data.summary,
      settings: data.settings,
      automation: data.automation,
      rows: items,
      pagination: { page, limit, total: filteredRows.length, pages },
      departments: [...new Set(data.rows.map(({ employee }) => employee.department).filter(Boolean))].sort(),
      missingCheckOuts: data.missingCheckOuts,
      activities: data.activities,
    });
  } catch (error) {
    console.error("Admin attendance day failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load attendance for this date" });
  }
};

export const exportAdminAttendanceDay = async (req, res) => {
  const date = req.query.date || getKarachiDateString();
  if (!isValidCalendarDate(date)) return res.status(400).json({ success: false, message: "date must be a valid YYYY-MM-DD date" });
  if (date > getKarachiDateString()) return res.status(400).json({ success: false, message: "Future attendance dates are not available" });
  if (req.query.status && !statusValues.includes(req.query.status)) return res.status(400).json({ success: false, message: "Invalid attendance status" });

  try {
    const data = await getDayData(date);
    const rows = filterRows(data.rows, req.query);
    const escapeCell = (value) => {
      const text = value === undefined || value === null ? "" : String(value);
      const safeText = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const csvRows = [
      ["Employee", "Email", "Department", "Status", "Check in", "Check out", "Worked minutes", "Leave days", "Leave period", "Recorded by"],
      ...rows.map(({ employee, day, approvedLeave }) => [
        employee.name,
        employee.email,
        employee.department || "",
        day.status,
        day.attendance?.checkIn ? new Date(day.attendance.checkIn).toISOString() : "",
        day.attendance?.checkOut ? new Date(day.attendance.checkOut).toISOString() : "",
        day.attendance?.workedMinutes ?? "",
        day.attendance?.leaveDays || approvedLeave?.days || "",
        day.attendance?.leavePeriod || approvedLeave?.period || "",
        day.attendance?.source || "Not recorded",
      ]),
    ];
    const csv = `\uFEFF${csvRows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${date}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("Admin attendance export failed:", error);
    return res.status(500).json({ success: false, message: "Unable to export attendance" });
  }
};

export const correctMissingCheckOut = async (req, res) => {
  const parsed = correctionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid correction details" });
  if (!objectIdPattern.test(req.params.attendanceId)) return res.status(400).json({ success: false, message: "Invalid attendance record" });
  try {
    const attendance = await attendanceModel.findOne({
      _id: req.params.attendanceId,
      missingCheckOut: true,
      checkIn: { $exists: true },
      checkOut: { $exists: false },
    });
    if (!attendance) return res.status(404).json({ success: false, message: "This attendance record no longer needs a checkout correction" });
    if (attendance.date >= getKarachiDateString()) return res.status(400).json({ success: false, message: "Checkout corrections are only available for completed days" });

    const checkOut = new Date(`${attendance.date}T${parsed.data.checkOutTime}:00+05:00`);
    if (Number.isNaN(checkOut.getTime()) || getKarachiDateString(checkOut) !== attendance.date) {
      return res.status(400).json({ success: false, message: "Checkout time must be on the attendance date" });
    }
    if (checkOut <= attendance.checkIn || checkOut > new Date()) {
      return res.status(400).json({ success: false, message: "Checkout must be after check-in and cannot be in the future" });
    }

    const workedMinutes = Math.floor((checkOut.getTime() - attendance.checkIn.getTime()) / 60000);
    const correction = new attendanceCorrectionModel({
      attendance: attendance._id,
      employee: attendance.employee,
      correctedBy: req.user._id,
      date: attendance.date,
      originalCheckIn: attendance.checkIn,
      originalCheckOut: attendance.checkOut,
      correctedCheckOut: checkOut,
      originalWorkedMinutes: attendance.workedMinutes,
      correctedWorkedMinutes: workedMinutes,
      originalSource: attendance.source,
      originalMissingCheckOut: attendance.missingCheckOut,
      reason: parsed.data.reason,
      note: parsed.data.note,
    });
    await correction.save();

    try {
      const updated = await attendanceModel.findOneAndUpdate(
        { _id: attendance._id, missingCheckOut: true, checkOut: { $exists: false } },
        { $set: { checkOut, workedMinutes, missingCheckOut: false, source: "admin" } },
        { new: true, runValidators: true },
      );
      if (!updated) {
        await correction.deleteOne();
        return res.status(409).json({ success: false, message: "This attendance record was updated by another administrator" });
      }
    } catch (error) {
      await correction.deleteOne();
      throw error;
    }
    return res.json({ success: true, message: "Checkout corrected and added to the audit history" });
  } catch (error) {
    console.error("Missing checkout correction failed:", error);
    return res.status(500).json({ success: false, message: "Unable to save the checkout correction" });
  }
};
