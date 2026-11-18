import { z } from "zod";
import attendanceModel from "../models/Attendance.js";
import {
  getHolidaySet,
  getOfficeSettings,
  haversineDistanceMeters,
  hasApprovedLeaveOn,
  isWeekend,
  isValidCalendarDate,
  todayKey,
  toKarachiMoment,
} from "../utils/attendanceHelpers.js";

const locationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative(),
}).strict();

const dateRangeSchema = z.object({
  from: z.string().refine(isValidCalendarDate, "from must be a valid YYYY-MM-DD date").optional(),
  to: z.string().refine(isValidCalendarDate, "to must be a valid YYYY-MM-DD date").optional(),
}).strict();

const validationError = (res, parsed) => res.status(400).json({
  success: false,
  message: parsed.error.issues[0]?.message || "Invalid request data",
});

const parseTime = (value) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const publicAttendance = (record) => record ? {
  id: record._id,
  date: record.date,
  checkIn: record.checkIn,
  checkOut: record.checkOut,
  status: record.status,
  missingCheckOut: record.missingCheckOut,
  lateMinutes: record.lateMinutes,
  checkInLocation: record.checkInLocation,
  checkOutLocation: record.checkOutLocation,
  workedMinutes: record.workedMinutes,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
} : null;

const ensureConfiguredOffice = (settings, res) => {
  if (!settings || !Number.isFinite(settings.latitude) || !Number.isFinite(settings.longitude)) {
    res.status(409).json({ success: false, message: "Office location is not set by admin" });
    return false;
  }
  return true;
};

const checkCalendar = async (dateKey, settings, res) => {
  const holidaySet = await getHolidaySet([dateKey]);
  if (holidaySet.has(dateKey)) {
    res.status(409).json({ success: false, message: "Today is a holiday" });
    return false;
  }
  if (isWeekend(dateKey, settings?.weekendDays || [0, 6])) {
    res.status(409).json({ success: false, message: "Today is a weekend day" });
    return false;
  }
  return true;
};

const checkShiftWindow = (user, moment, res) => {
  if (!user.shiftStart || !user.shiftEnd) {
    res.status(409).json({ success: false, message: "Your shift has not been configured" });
    return false;
  }
  const shiftStart = parseTime(user.shiftStart);
  const shiftEnd = parseTime(user.shiftEnd);
  if (moment.totalMinutes < shiftStart - 120) {
    res.status(409).json({ success: false, message: "Check-in is not available yet" });
    return false;
  }
  if (moment.totalMinutes > shiftEnd) {
    res.status(409).json({ success: false, message: "The shift has ended" });
    return false;
  }
  return true;
};

const verifyLocation = (location, settings, res) => {
  if (location.accuracy > 100) {
    res.status(422).json({ success: false, message: "GPS accuracy is too low. Move to an open area and try again." });
    return null;
  }
  const distance = haversineDistanceMeters(
    settings.latitude,
    settings.longitude,
    location.lat,
    location.lng,
  );
  const radiusMeters = settings.radiusMeters ?? 100;
  if (distance > radiusMeters) {
    res.status(403).json({ success: false, message: `You are more than ${radiusMeters} meters away from the office` });
    return null;
  }
  return distance;
};

export const getTodayAttendance = async (req, res) => {
  try {
    const date = todayKey();
    const [record, settings] = await Promise.all([
      attendanceModel.findOne({ employee: req.user._id, date }).lean(),
      getOfficeSettings(),
    ]);
    const state = { canCheckIn: false, canCheckOut: Boolean(record?.checkIn && !record?.checkOut), reason: null };
    if (record?.checkOut) state.reason = "Today's attendance is complete";
    else if (record) state.reason = "You have already checked in today";
    else if (!settings || !Number.isFinite(settings.latitude) || !Number.isFinite(settings.longitude)) state.reason = "Office location is not set by admin";
    else {
      const holidaySet = await getHolidaySet([date]);
      if (holidaySet.has(date)) state.reason = "Today is a holiday";
      else if (isWeekend(date, settings.weekendDays)) state.reason = "Today is a weekend day";
      else if (!req.user.shiftStart || !req.user.shiftEnd) state.reason = "Your shift has not been configured";
      else {
        const moment = toKarachiMoment();
        const shiftStart = parseTime(req.user.shiftStart);
        const shiftEnd = parseTime(req.user.shiftEnd);
        if (moment.totalMinutes < shiftStart - 120) state.reason = "Check-in is not available yet";
        else if (moment.totalMinutes > shiftEnd) state.reason = "The shift has ended";
        else state.canCheckIn = true;
      }
    }
    return res.status(200).json({ success: true, date, record: publicAttendance(record), state });
  } catch (error) {
    console.error("Get today attendance failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const checkIn = async (req, res) => {
  try {
    const parsed = locationSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const settings = await getOfficeSettings();
    if (!ensureConfiguredOffice(settings, res)) return;
    const moment = toKarachiMoment();
    if (!(await checkCalendar(moment.dateKey, settings, res))) return;
    if (await hasApprovedLeaveOn(req.user._id, moment.dateKey)) {
      return res.status(409).json({ success: false, message: "You are on leave today" });
    }
    if (!checkShiftWindow(req.user, moment, res)) return;

    const existing = await attendanceModel.findOne({ employee: req.user._id, date: moment.dateKey });
    if (existing) {
      return res.status(409).json({ success: false, message: "You have already checked in today" });
    }

    const distance = verifyLocation(parsed.data, settings, res);
    if (distance === null) return;
    const shiftStart = parseTime(req.user.shiftStart);
    const graceMinutes = settings.graceMinutes ?? 15;
    const minuteOfDay = Math.floor(moment.totalMinutes);
    const isLate = minuteOfDay > shiftStart + graceMinutes;
    const record = await attendanceModel.create({
      employee: req.user._id,
      date: moment.dateKey,
      checkIn: new Date(),
      status: isLate ? "late" : "present",
      lateMinutes: isLate ? Math.max(0, minuteOfDay - shiftStart) : 0,
      checkInLocation: { ...parsed.data, distance: Math.round(distance * 100) / 100 },
    });

    return res.status(201).json({ success: true, message: isLate ? "Check-in successful (late)" : "Check-in successful", attendance: publicAttendance(record) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "You have already checked in today" });
    console.error("Check-in failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const checkOut = async (req, res) => {
  try {
    const parsed = locationSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const settings = await getOfficeSettings();
    if (!ensureConfiguredOffice(settings, res)) return;
    const date = todayKey();
    const record = await attendanceModel.findOne({ employee: req.user._id, date });
    if (!record) return res.status(409).json({ success: false, message: "No check-in record was found for today" });
    if (record.checkOut) return res.status(409).json({ success: false, message: "You have already checked out today" });

    const distance = verifyLocation(parsed.data, settings, res);
    if (distance === null) return;
    const checkoutTime = new Date();
    record.checkOut = checkoutTime;
    record.checkOutLocation = { ...parsed.data, distance: Math.round(distance * 100) / 100 };
    record.workedMinutes = Math.max(0, Math.floor((checkoutTime.getTime() - record.checkIn.getTime()) / 60000));
    await record.save();

    return res.status(200).json({ success: true, message: "Check-out successful", attendance: publicAttendance(record) });
  } catch (error) {
    console.error("Check-out failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAttendanceHistory = async (req, res) => {
  try {
    const parsed = dateRangeSchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed);
    if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
      return res.status(400).json({ success: false, message: "from cannot be later than to" });
    }
    const filter = { employee: req.user._id };
    if (parsed.data.from || parsed.data.to) {
      filter.date = {};
      if (parsed.data.from) filter.date.$gte = parsed.data.from;
      if (parsed.data.to) filter.date.$lte = parsed.data.to;
    }
    const records = await attendanceModel.find(filter).sort({ date: -1 }).limit(100).lean();
    return res.status(200).json({ success: true, attendance: records.map(publicAttendance) });
  } catch (error) {
    console.error("Get attendance history failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
