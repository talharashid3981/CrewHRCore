import attendanceModel from "../models/Attendance.js";
import attendanceAutomationRunModel from "../models/AttendanceAutomationRun.js";
import automationStateModel from "../models/AutomationState.js";
import holidayModel from "../models/Holiday.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import officeSettingsModel from "../models/OfficeSettings.js";
import userModel from "../models/User.js";
import { addDays, compareDates } from "./leaveService.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { isWeekend, toKarachiMoment } from "../utils/attendanceHelpers.js";
import { expandHolidayDates, holidayRangeQuery } from "../utils/holidayCalendar.js";

let isClosing = false;

const yesterdayKey = () => addDays(getKarachiDateString(), -1);
const dateToKey = (date) => date ? getKarachiDateString(date) : null;

const eligibleFrom = (employee) => {
  const joining = dateToKey(employee.joiningDate);
  const approvalDayAfter = employee.approvedAt ? addDays(dateToKey(employee.approvedAt), 1) : null;
  if (!joining) return approvalDayAfter;
  if (!approvalDayAfter) return joining;
  return joining > approvalDayAfter ? joining : approvalDayAfter;
};

export const getAttendanceStartDate = eligibleFrom;

const getContext = async (from, to) => {
  const [settings, holidays, leaveRequests] = await Promise.all([
    officeSettingsModel.findOne({ key: "default" }).select("weekendDays").lean(),
    holidayModel.find(holidayRangeQuery(from, to)).select("date to").lean(),
    leaveRequestModel.find({ status: "approved", from: { $lte: to }, to: { $gte: from } }).select("employee from to duration halfDayPeriod").lean(),
  ]);
  return {
    weekendDays: settings?.weekendDays || [0, 6],
    holidays: expandHolidayDates(holidays, from, to),
    leaves: leaveRequests,
  };
};

export const getResolutionContext = getContext;

const leaveFor = (leaves, employeeId, date) => leaves.find((leave) => String(leave.employee) === String(employeeId) && leave.from <= date && leave.to >= date);
const leaveOn = (leaves, employeeId, date) => {
  const leave = leaveFor(leaves, employeeId, date);
  return Boolean(leave && leave.duration !== "half");
};
const resolvedStoredStatus = (row, leave) => leave?.duration === "half" && row?.status === "leave" && !row.checkIn
  ? "absent"
  : row?.status;
const halfDayInfo = (leave) => leave?.duration === "half"
  ? { leaveDays: 0.5, leavePeriod: leave.halfDayPeriod }
  : {};

const parseShiftMinutes = (value) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export const isAttendanceDeadlinePassed = (employee, date, leave, moment) => {
  if (date < moment.dateKey) return true;
  if (date !== moment.dateKey) return false;
  if (!employee) return false;
  const shiftStart = parseShiftMinutes(employee.shiftStart);
  const shiftEnd = parseShiftMinutes(employee.shiftEnd);
  if (shiftStart === null || shiftEnd === null) return false;

  const isAfternoonLeave = leave?.duration === "half" && leave.halfDayPeriod === "afternoon";
  const deadline = isAfternoonLeave ? (shiftStart + shiftEnd) / 2 : shiftEnd;
  return isAfternoonLeave
    ? moment.totalMinutes >= deadline
    : moment.totalMinutes > deadline;
};

const getEligibleEmployees = async () => userModel.find({ role: "employee", isActive: true, onboardingStatus: "approved" }).select("_id joiningDate approvedAt").lean();

const processRange = async (from, to) => {
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) return { from, to, processedDays: 0, insertedRows: 0, skippedWeekends: 0 };
  const [context, employees] = await Promise.all([getContext(from, to), getEligibleEmployees()]);
  const dates = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  const employeeIds = employees.map((employee) => employee._id);
  const existingRows = employeeIds.length ? await attendanceModel.find({ employee: { $in: employeeIds }, date: { $gte: from, $lte: to } }).lean() : [];
  const existingMap = new Map(existingRows.map((row) => [`${row.employee}:${row.date}`, row]));
  const operations = [];
  let skippedWeekends = 0;

  for (const date of dates) {
    if (isWeekend(date, context.weekendDays)) { skippedWeekends += 1; continue; }
    for (const employee of employees) {
      const start = eligibleFrom(employee);
      if (!start || date < start) continue;
      const key = `${employee._id}:${date}`;
      const existing = existingMap.get(key);
      if (existing) {
        const leave = leaveFor(context.leaves, employee._id, date);
        if (leave?.duration === "half" && (existing.leaveDays !== 0.5 || existing.leavePeriod !== leave.halfDayPeriod || (existing.source === "system" && existing.status === "leave" && !existing.checkIn))) {
          operations.push({ updateOne: { filter: { _id: existing._id }, update: { $set: { ...halfDayInfo(leave), ...(existing.source === "system" && existing.status === "leave" && !existing.checkIn ? { status: "absent" } : {}) } } } });
        }
        if (existing.checkIn && !existing.checkOut && !existing.missingCheckOut) {
          operations.push({ updateOne: { filter: { _id: existing._id, checkOut: { $exists: false } }, update: { $set: { missingCheckOut: true } } } });
        }
        continue;
      }
      const leave = leaveFor(context.leaves, employee._id, date);
      const status = context.holidays.has(date) ? "holiday" : leaveOn(context.leaves, employee._id, date) ? "leave" : "absent";
      operations.push({ updateOne: { filter: { employee: employee._id, date }, update: { $setOnInsert: { employee: employee._id, date, status, source: "system", missingCheckOut: false, ...halfDayInfo(leave) } }, upsert: true } });
    }
  }
  if (operations.length) await attendanceModel.bulkWrite(operations, { ordered: false });
  return { from, to, processedDays: dates.length, insertedRows: operations.length, skippedWeekends };
};

export const closeDays = async ({ source = "scheduled", initiatedBy = null } = {}) => {
  if (isClosing) {
    const message = "A daily attendance close is already running";
    await attendanceAutomationRunModel.create({ source, initiatedBy, status: "no_op", message });
    return { skipped: true, reason: "already_running", message };
  }
  isClosing = true;
  try {
    const end = yesterdayKey();
    const state = await automationStateModel.findOne({ key: "dailyClose" }).lean();
    const start = state?.lastProcessedDate ? addDays(state.lastProcessedDate, 1) : end;
    if (start > end) {
      const message = `Attendance is already closed through ${end}`;
      await attendanceAutomationRunModel.create({ source, initiatedBy, toDate: end, status: "no_op", message });
      return { skipped: true, reason: "up_to_date", throughDate: end, message };
    }
    const cappedEnd = compareDates(addDays(start, 30), end) < 0 ? addDays(start, 30) : end;
    const result = await processRange(start, cappedEnd);
    await automationStateModel.findOneAndUpdate({ key: "dailyClose" }, { $set: { lastProcessedDate: cappedEnd } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await attendanceAutomationRunModel.create({
      source,
      initiatedBy,
      fromDate: start,
      toDate: cappedEnd,
      status: "completed",
      processedDays: result.processedDays,
      processedRows: result.insertedRows,
      skippedWeekends: result.skippedWeekends,
    });
    return result;
  } catch (error) {
    try {
      await attendanceAutomationRunModel.create({ source, initiatedBy, status: "failed", message: "Daily close failed" });
    } catch (logError) {
      console.error("Attendance automation failure logging failed:", logError);
    }
    throw error;
  } finally { isClosing = false; }
};

export const resolveDayStatus = async (employeeId, dateKey, currentMoment = toKarachiMoment()) => {
  const [employee, existing, context] = await Promise.all([
    userModel.findById(employeeId).select("joiningDate approvedAt shiftStart shiftEnd").lean(),
    attendanceModel.findOne({ employee: employeeId, date: dateKey }).lean(),
    getContext(dateKey, dateKey),
  ]);
  const employeeStart = employee ? eligibleFrom(employee) : null;
  if (!employeeStart || dateKey < employeeStart) return "notEligible";
  const leave = leaveFor(context.leaves, employeeId, dateKey);
  if (existing) return resolvedStoredStatus(existing, leave);
  if (isWeekend(dateKey, context.weekendDays)) return "weekend";
  if (context.holidays.has(dateKey)) return "holiday";
  if (leaveOn(context.leaves, employeeId, dateKey)) return "leave";
  return isAttendanceDeadlinePassed(employee, dateKey, leave, currentMoment) ? "absent" : "pending";
};

export const resolveRange = async (employeeId, from, to) => {
  const [employee, context, rows] = await Promise.all([
    userModel.findById(employeeId).select("joiningDate approvedAt shiftStart shiftEnd").lean(),
    getContext(from, to),
    attendanceModel.find({ employee: employeeId, date: { $gte: from, $lte: to } }).lean(),
  ]);
  const rowMap = new Map(rows.map((row) => [row.date, row]));
  const employeeStart = employee ? eligibleFrom(employee) : null;
  const currentMoment = toKarachiMoment();
  const result = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const row = rowMap.get(date);
    const leave = leaveFor(context.leaves, employeeId, date);
    let status = row?.status;
    if (!employeeStart || date < employeeStart) status = "notEligible";
    else if (status) status = resolvedStoredStatus(row, leave);
    else {
      if (isWeekend(date, context.weekendDays)) status = "weekend";
      else if (context.holidays.has(date)) status = "holiday";
      else if (leaveOn(context.leaves, employeeId, date)) status = "leave";
      else status = isAttendanceDeadlinePassed(employee, date, leave, currentMoment) ? "absent" : "pending";
    }
    const attendance = status === "notEligible" ? null : row || (leave?.duration === "half" ? {} : null);
    result.push({ date, status, attendance: attendance ? { ...attendance, status, ...halfDayInfo(leave) } : null });
  }
  return result;
};

export const resolveRangeBulk = async (employees, from, to) => {
  const employeeIds = employees.map((employee) => employee._id);
  const [context, rows] = await Promise.all([
    getContext(from, to),
    employeeIds.length ? attendanceModel.find({ employee: { $in: employeeIds }, date: { $gte: from, $lte: to } }).lean() : [],
  ]);
  const rowMap = new Map(rows.map((row) => [`${row.employee}:${row.date}`, row]));
  const currentMoment = toKarachiMoment();
  const result = new Map();
  for (const employee of employees) {
    const employeeRows = [];
    const employeeStart = eligibleFrom(employee);
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const row = rowMap.get(`${employee._id}:${date}`);
      const leave = leaveFor(context.leaves, employee._id, date);
      let status = resolvedStoredStatus(row, leave);
      if (!employeeStart || date < employeeStart) status = "notEligible";
      else if (!status) {
        if (isWeekend(date, context.weekendDays)) status = "weekend";
        else if (context.holidays.has(date)) status = "holiday";
        else if (leaveOn(context.leaves, employee._id, date)) status = "leave";
        else status = isAttendanceDeadlinePassed(employee, date, leave, currentMoment) ? "absent" : "pending";
      }
      const attendance = status === "notEligible" ? null : row || (leave?.duration === "half" ? {} : null);
      employeeRows.push({ date, status, attendance: attendance ? { ...attendance, status, ...halfDayInfo(leave) } : null });
    }
    result.set(String(employee._id), employeeRows);
  }
  return result;
};

export const recomputeSystemRows = async (from, to) => {
  const yesterday = yesterdayKey();
  const end = to < yesterday ? to : yesterday;
  if (from > end) return { from, to: end, deletedRows: 0, result: null };
  const deleted = await attendanceModel.deleteMany({ date: { $gte: from, $lte: end }, source: "system" });
  const result = await processRange(from, end);
  return { from, to: end, deletedRows: deleted.deletedCount, result };
};
