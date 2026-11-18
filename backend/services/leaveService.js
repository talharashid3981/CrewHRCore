import officeSettingsModel from "../models/OfficeSettings.js";
import holidayModel from "../models/Holiday.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import leaveTypeModel from "../models/LeaveType.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";

export const addDays = (dateKey, amount) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
};

export const compareDates = (left, right) => left.localeCompare(right);

export const isUnlimitedLeaveType = (type) =>
  Boolean(
    type.isUnlimited ||
      type.name?.trim().toLowerCase() === "unpaid leave",
  );

export const getWorkingDays = async (from, to) => {
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) return { days: 0, dates: [] };
  const settings = await officeSettingsModel.findOne({ key: "default" }).select("weekendDays").lean();
  const weekendDays = settings?.weekendDays || [0, 6];
  const holidays = await holidayModel.find({ date: { $gte: from, $lte: to } }).select("date").lean();
  const holidaySet = new Set(holidays.map((holiday) => holiday.date));
  const dates = [];
  for (let current = from; current <= to; current = addDays(current, 1)) {
    const [year, month, day] = current.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (!weekendDays.includes(weekday) && !holidaySet.has(current)) dates.push(current);
  }
  return { days: dates.length, dates };
};

export const getLeaveBalances = async (employeeId, year) => {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const [types, totals] = await Promise.all([
    leaveTypeModel.find().sort({ name: 1 }).lean(),
    leaveRequestModel.aggregate([
      { $match: { employee: employeeId, status: { $in: ["approved", "pending"] }, from: { $lte: end }, to: { $gte: start } } },
      { $group: { _id: { leaveType: "$leaveType", status: "$status" }, days: { $sum: "$days" } } },
    ]),
  ]);
  const totalMap = new Map(totals.map((item) => [`${item._id.leaveType}:${item._id.status}`, item.days]));
  return types.map((type) => {
    const approved = totalMap.get(`${type._id}:approved`) || 0;
    const pending = totalMap.get(`${type._id}:pending`) || 0;
    const isUnlimited = isUnlimitedLeaveType(type);
    return {
      leaveType: type._id,
      name: type.name,
      yearlyQuota: isUnlimited ? null : type.yearlyQuota,
      approved,
      pending,
      remaining: isUnlimited ? null : type.yearlyQuota - approved,
      available: isUnlimited ? null : type.yearlyQuota - approved - pending,
      isUnlimited,
      isActive: type.isActive,
    };
  });
};

export const hasApprovedLeaveOn = async (employeeId, dateKey) => Boolean(await leaveRequestModel.exists({ employee: employeeId, status: "approved", from: { $lte: dateKey }, to: { $gte: dateKey } }));

export const getValidation = (from, to) => {
  const today = getKarachiDateString();
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to)) return "Dates must be valid YYYY-MM-DD dates";
  if (from > to) return "From date cannot be later than to date";
  if (from < today) return "Leave cannot be requested for past dates";
  if (from.slice(0, 4) !== to.slice(0, 4)) return "Cross-year leave is not allowed; submit separate requests";
  const endAfter60 = addDays(from, 59);
  if (to > endAfter60) return "The leave range cannot exceed 60 days";
  return null;
};
