import officeSettingsModel from "../models/OfficeSettings.js";
import holidayModel from "../models/Holiday.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import leavePolicyModel from "../models/LeavePolicy.js";
import leaveTypeModel from "../models/LeaveType.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { expandHolidayDates, holidayRangeQuery } from "../utils/holidayCalendar.js";

export const DEFAULT_LEAVE_POLICY = Object.freeze({
  allowHalfDay: true,
  requireReason: true,
  allowPastDatedRequests: false,
  pastDatedLimitDays: 7,
  leaveYearStart: "01-01",
});

export const addDays = (dateKey, amount) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
};

const dateForLeaveYear = (year, month, day) => {
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, maxDay)).padStart(2, "0")}`;
};

export const getLeavePolicy = async () => {
  const policy = await leavePolicyModel.findOne({ key: "default" }).lean();
  return {
    ...DEFAULT_LEAVE_POLICY,
    allowHalfDay: policy?.allowHalfDay ?? DEFAULT_LEAVE_POLICY.allowHalfDay,
    requireReason: policy?.requireReason ?? DEFAULT_LEAVE_POLICY.requireReason,
    allowPastDatedRequests: policy?.allowPastDatedRequests ?? DEFAULT_LEAVE_POLICY.allowPastDatedRequests,
    pastDatedLimitDays: policy?.pastDatedLimitDays ?? DEFAULT_LEAVE_POLICY.pastDatedLimitDays,
    leaveYearStart: policy?.leaveYearStart ?? DEFAULT_LEAVE_POLICY.leaveYearStart,
  };
};

export const getLeaveYearRange = (year, policy = DEFAULT_LEAVE_POLICY) => {
  const [month, day] = (policy.leaveYearStart || DEFAULT_LEAVE_POLICY.leaveYearStart).split("-").map(Number);
  const from = dateForLeaveYear(year, month, day);
  const nextYearStart = dateForLeaveYear(year + 1, month, day);
  return { from, to: addDays(nextYearStart, -1) };
};

export const getLeaveYearForDate = (dateKey, policy = DEFAULT_LEAVE_POLICY) => {
  const calendarYear = Number(dateKey.slice(0, 4));
  const [month, day] = (policy.leaveYearStart || DEFAULT_LEAVE_POLICY.leaveYearStart).split("-").map(Number);
  const start = dateForLeaveYear(calendarYear, month, day);
  return dateKey >= start ? calendarYear : calendarYear - 1;
};

export const getCurrentLeaveYear = async (dateKey = getKarachiDateString()) =>
  getLeaveYearForDate(dateKey, await getLeavePolicy());

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
  const holidays = await holidayModel.find(holidayRangeQuery(from, to)).select("date to").lean();
  const holidaySet = expandHolidayDates(holidays, from, to);
  const dates = [];
  let weekendDaysCount = 0;
  let holidayDaysCount = 0;
  for (let current = from; current <= to; current = addDays(current, 1)) {
    const [year, month, day] = current.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (holidaySet.has(current)) {
      holidayDaysCount += 1;
    } else if (weekendDays.includes(weekday)) {
      weekendDaysCount += 1;
    } else {
      dates.push(current);
    }
  }
  return { days: dates.length, dates, weekendDaysCount, holidayDaysCount };
};

export const getLeaveBalances = async (employeeId, year) => {
  const policy = await getLeavePolicy();
  const currentRange = getLeaveYearRange(year, policy);
  const previousRange = getLeaveYearRange(year - 1, policy);
  const [types, totals, previousTotals] = await Promise.all([
    leaveTypeModel.find().sort({ name: 1 }).lean(),
    leaveRequestModel.aggregate([
      { $match: { employee: employeeId, status: { $in: ["approved", "pending"] }, from: { $lte: currentRange.to }, to: { $gte: currentRange.from } } },
      { $group: { _id: { leaveType: "$leaveType", status: "$status" }, days: { $sum: "$days" } } },
    ]),
    leaveRequestModel.aggregate([
      { $match: { employee: employeeId, status: "approved", from: { $lte: previousRange.to }, to: { $gte: previousRange.from } } },
      { $group: { _id: "$leaveType", days: { $sum: "$days" } } },
    ]),
  ]);
  const totalMap = new Map(totals.map((item) => [`${item._id.leaveType}:${item._id.status}`, item.days]));
  const previousMap = new Map(previousTotals.map((item) => [String(item._id), item.days]));
  const previousQuotaMap = new Map(types.map((type) => [String(type._id), type.yearlyQuota || 0]));
  return types.map((type) => {
    const approved = totalMap.get(`${type._id}:approved`) || 0;
    const pending = totalMap.get(`${type._id}:pending`) || 0;
    const isUnlimited = isUnlimitedLeaveType(type);
    const yearlyQuota = type.yearlyQuota || 0;
    const carryForward = isUnlimited
      ? 0
      : Math.min(type.carryForwardDays || 0, Math.max(0, (previousQuotaMap.get(String(type._id)) || 0) - (previousMap.get(String(type._id)) || 0)));
    const effectiveQuota = isUnlimited ? null : yearlyQuota + carryForward;
    return {
      leaveType: type._id,
      name: type.name,
      yearlyQuota: isUnlimited ? null : yearlyQuota,
      carryForward,
      effectiveQuota,
      approved,
      pending,
      remaining: isUnlimited ? null : effectiveQuota - approved,
      available: isUnlimited ? null : effectiveQuota - approved - pending,
      isUnlimited,
      isActive: type.isActive,
    };
  });
};

export const hasApprovedLeaveOn = async (employeeId, dateKey) => Boolean(await leaveRequestModel.exists({ employee: employeeId, status: "approved", from: { $lte: dateKey }, to: { $gte: dateKey } }));

export const getValidation = (from, to, policy = DEFAULT_LEAVE_POLICY) => {
  const today = getKarachiDateString();
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to)) return "Dates must be valid YYYY-MM-DD dates";
  if (from > to) return "From date cannot be later than to date";
  const earliestDate = policy.allowPastDatedRequests
    ? addDays(today, -(policy.pastDatedLimitDays || DEFAULT_LEAVE_POLICY.pastDatedLimitDays))
    : today;
  if (from < earliestDate) return policy.allowPastDatedRequests
    ? `Past-dated requests are limited to the last ${policy.pastDatedLimitDays} days`
    : "Leave cannot be requested for past dates";
  if (getLeaveYearForDate(from, policy) !== getLeaveYearForDate(to, policy)) return "Leave cannot cross the leave-year boundary; submit separate requests";
  const endAfter60 = addDays(from, 59);
  if (to > endAfter60) return "The leave range cannot exceed 60 days";
  return null;
};
