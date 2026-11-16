import officeSettingsModel from "../models/OfficeSettings.js";
import holidayModel from "../models/Holiday.js";
import { isValidCalendarDate } from "./calendar.js";
import leaveRequestModel from "../models/LeaveRequest.js";

const partsForKarachi = (date) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
}).formatToParts(date).reduce((result, part) => {
  if (part.type !== "literal") result[part.type] = Number(part.value);
  return result;
}, {});

export const toKarachiMoment = (date = new Date()) => {
  const parts = partsForKarachi(date);
  parts.millisecond = date.getMilliseconds();
  return {
    ...parts,
    dateKey: `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    totalMinutes: parts.hour * 60 + parts.minute + parts.second / 60 + parts.millisecond / 60000,
  };
};

export const todayKey = () => toKarachiMoment().dateKey;

export { isValidCalendarDate };

export const isWeekend = (dateKey, weekendDays = [0, 6]) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekendDays.includes(weekday);
};

export const getOfficeSettings = () => officeSettingsModel.findOne({ key: "default" });

export const getHolidaySet = async (dateKeys = []) => {
  const filter = dateKeys.length ? { date: { $in: dateKeys } } : {};
  const holidays = await holidayModel.find(filter).select("date").lean();
  return new Set(holidays.map((holiday) => holiday.date));
};

export const haversineDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const hasApprovedLeaveOn = async (employeeId, dateKey) => Boolean(await leaveRequestModel.exists({
  employee: employeeId,
  status: "approved",
  from: { $lte: dateKey },
  to: { $gte: dateKey },
}));
