import attendanceModel from "../models/Attendance.js";
import automationStateModel from "../models/AutomationState.js";
import holidayModel from "../models/Holiday.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import officeSettingsModel from "../models/OfficeSettings.js";
import userModel from "../models/User.js";
import { addDays, compareDates } from "./leaveService.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { isWeekend } from "../utils/attendanceHelpers.js";

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

const getContext = async (from, to) => {
  const [settings, holidays, leaveRequests] = await Promise.all([
    officeSettingsModel.findOne({ key: "default" }).select("weekendDays").lean(),
    holidayModel.find({ date: { $gte: from, $lte: to } }).select("date").lean(),
    leaveRequestModel.find({ status: "approved", from: { $lte: to }, to: { $gte: from } }).select("employee from to").lean(),
  ]);
  return {
    weekendDays: settings?.weekendDays || [0, 6],
    holidays: new Set(holidays.map((holiday) => holiday.date)),
    leaves: leaveRequests,
  };
};

export const getResolutionContext = getContext;

const leaveOn = (leaves, employeeId, date) => leaves.some((leave) => String(leave.employee) === String(employeeId) && leave.from <= date && leave.to >= date);

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
        if (existing.checkIn && !existing.checkOut && !existing.missingCheckOut) {
          operations.push({ updateOne: { filter: { _id: existing._id, checkOut: { $exists: false } }, update: { $set: { missingCheckOut: true } } } });
        }
        continue;
      }
      const status = context.holidays.has(date) ? "holiday" : leaveOn(context.leaves, employee._id, date) ? "leave" : "absent";
      operations.push({ updateOne: { filter: { employee: employee._id, date }, update: { $setOnInsert: { employee: employee._id, date, status, source: "system", missingCheckOut: false } }, upsert: true } });
    }
  }
  if (operations.length) await attendanceModel.bulkWrite(operations, { ordered: false });
  return { from, to, processedDays: dates.length, insertedRows: operations.length, skippedWeekends };
};

export const closeDays = async () => {
  if (isClosing) return { skipped: true, message: "Daily close is already running" };
  isClosing = true;
  try {
    const end = yesterdayKey();
    const state = await automationStateModel.findOne({ key: "dailyClose" }).lean();
    const start = state?.lastProcessedDate ? addDays(state.lastProcessedDate, 1) : end;
    if (start > end) return { skipped: true, message: "No closed days to process" };
    const cappedEnd = compareDates(addDays(start, 30), end) < 0 ? addDays(start, 30) : end;
    const result = await processRange(start, cappedEnd);
    await automationStateModel.findOneAndUpdate({ key: "dailyClose" }, { $set: { lastProcessedDate: cappedEnd } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return result;
  } finally { isClosing = false; }
};

export const resolveDayStatus = async (employeeId, dateKey) => {
  const existing = await attendanceModel.findOne({ employee: employeeId, date: dateKey }).lean();
  if (existing) return existing.status;
  const context = await getContext(dateKey, dateKey);
  if (isWeekend(dateKey, context.weekendDays)) return "weekend";
  if (context.holidays.has(dateKey)) return "holiday";
  if (leaveOn(context.leaves, employeeId, dateKey)) return "leave";
  return dateKey < getKarachiDateString() ? "absent" : "pending";
};

export const resolveRange = async (employeeId, from, to) => {
  const [employee, context, rows] = await Promise.all([
    userModel.findById(employeeId).select("joiningDate approvedAt").lean(),
    getContext(from, to),
    attendanceModel.find({ employee: employeeId, date: { $gte: from, $lte: to } }).lean(),
  ]);
  const rowMap = new Map(rows.map((row) => [row.date, row]));
  const employeeStart = employee ? eligibleFrom(employee) : null;
  const result = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const row = rowMap.get(date);
    let status = row?.status;
    if (!employeeStart || date < employeeStart) status = "notEligible";
    else if (!status) {
      if (isWeekend(date, context.weekendDays)) status = "weekend";
      else if (context.holidays.has(date)) status = "holiday";
      else if (leaveOn(context.leaves, employeeId, date)) status = "leave";
      else status = date < getKarachiDateString() ? "absent" : "pending";
    }
    result.push({ date, status, attendance: status === "notEligible" ? null : row || null });
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
  const today = getKarachiDateString();
  const result = new Map();
  for (const employee of employees) {
    const employeeRows = [];
    const employeeStart = eligibleFrom(employee);
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const row = rowMap.get(`${employee._id}:${date}`);
      let status = row?.status;
      if (!employeeStart || date < employeeStart) status = "notEligible";
      else if (!status) {
        if (isWeekend(date, context.weekendDays)) status = "weekend";
        else if (context.holidays.has(date)) status = "holiday";
        else if (leaveOn(context.leaves, employee._id, date)) status = "leave";
        else status = date < today ? "absent" : "pending";
      }
      employeeRows.push({ date, status, attendance: status === "notEligible" ? null : row || null });
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
