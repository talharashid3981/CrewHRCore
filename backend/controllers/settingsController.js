import mongoose from "mongoose";
import { z } from "zod";
import officeSettingsModel from "../models/OfficeSettings.js";
import holidayModel from "../models/Holiday.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { holidayEnd, holidayRangeQuery, holidayStart } from "../utils/holidayCalendar.js";

const weekendDaysSchema = z.array(z.number().int().min(0).max(6)).max(7).refine(
  (days) => new Set(days).size === days.length,
  "Weekend days must be unique",
);

const officeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  radiusMeters: z.number().int().min(20).max(1000).optional(),
  graceMinutes: z.number().int().min(0).max(120).optional(),
  weekendDays: weekendDaysSchema.optional(),
}).strict();

const holidaySchema = z.object({
  name: z.string().trim().min(1, "Holiday name is required").max(150),
  date: z.string().refine(isValidCalendarDate, "Date must be a valid YYYY-MM-DD date").optional(),
  from: z.string().refine(isValidCalendarDate, "From date must be a valid YYYY-MM-DD date").optional(),
  to: z.string().refine(isValidCalendarDate, "To date must be a valid YYYY-MM-DD date").optional(),
  description: z.string().trim().max(500).optional(),
}).strict();
const holidayUpdateSchema = holidaySchema.partial().strict();

const validationError = (res, parsed) => res.status(400).json({
  success: false,
  message: parsed.error.issues[0]?.message || "Invalid request data",
});

const notFound = (res, message = "Holiday not found") => res.status(404).json({
  success: false,
  message,
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const normalizedHoliday = (holiday) => {
  const date = holiday.from || holiday.date;
  const result = { name: holiday.name, date };
  const to = holiday.to || date;
  if (to !== date) result.to = to;
  if (holiday.description !== undefined) result.description = holiday.description;
  return result;
};
const holidayRangeError = (from, to) => {
  if (!from) return "Holiday start date is required";
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to)) return "Holiday dates must be valid YYYY-MM-DD dates";
  if (from > to) return "To date cannot be before from date";
  if ((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000 > 365) {
    return "A holiday range cannot exceed 366 days";
  }
  return null;
};
const findHolidayConflicts = async (from, to, excludeId) => {
  const conflicts = await holidayModel.find({
    ...holidayRangeQuery(from, to),
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("date to name").lean();
  const overlappingDates = new Set();
  for (const holiday of conflicts) {
    const start = holidayStart(holiday) < from ? from : holidayStart(holiday);
    const end = holidayEnd(holiday) > to ? to : holidayEnd(holiday);
    for (let date = start; date <= end;) {
      overlappingDates.add(date);
      const [year, month, day] = date.split("-").map(Number);
      date = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    }
  }
  return [...overlappingDates].sort();
};

const officeResponse = (settings, includeCoordinates) => {
  const response = {
    id: settings?._id,
    name: settings?.name || "Main Office",
    radiusMeters: settings?.radiusMeters ?? 100,
    graceMinutes: settings?.graceMinutes ?? 15,
    weekendDays: settings?.weekendDays || [0, 6],
    isConfigured: Number.isFinite(settings?.latitude) && Number.isFinite(settings?.longitude),
    updatedAt: settings?.updatedAt,
  };
  if (includeCoordinates) {
    response.latitude = settings?.latitude ?? null;
    response.longitude = settings?.longitude ?? null;
  }
  return response;
};

const getSettings = async () => officeSettingsModel.findOne({ key: "default" });

export const getOfficeSettings = async (req, res) => {
  try {
    const settings = await getSettings();
    return res.status(200).json({
      success: true,
      settings: officeResponse(settings, req.user.role === "admin"),
    });
  } catch (error) {
    console.error("Get office settings failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateOfficeSettings = async (req, res) => {
  try {
    const parsed = officeUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    const coordinatesChanged = hasOwn(parsed.data, "latitude") || hasOwn(parsed.data, "longitude");
    if (coordinatesChanged && (!hasOwn(parsed.data, "latitude") || !hasOwn(parsed.data, "longitude"))) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be updated together",
      });
    }
    if (coordinatesChanged && ((parsed.data.latitude === null) !== (parsed.data.longitude === null))) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must both be set or both be null",
      });
    }

    let settings = await getSettings();
    if (!settings) settings = new officeSettingsModel({ key: "default" });
    Object.assign(settings, parsed.data);
    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Office settings updated",
      settings: officeResponse(settings, true),
    });
  } catch (error) {
    console.error("Update office settings failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const listHolidays = async (req, res) => {
  try {
    const from = req.query.from || getKarachiDateString();
    const to = req.query.to;
    if (!isValidCalendarDate(from) || (to && !isValidCalendarDate(to))) {
      return res.status(400).json({ success: false, message: "from and to must be valid YYYY-MM-DD dates" });
    }
    if (to && from > to) {
      return res.status(400).json({ success: false, message: "from cannot be later than to" });
    }

    const holidays = await holidayModel.find(holidayRangeQuery(from, to || "2200-12-31")).sort({ date: 1 });
    return res.status(200).json({ success: true, holidays });
  } catch (error) {
    console.error("List holidays failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createHoliday = async (req, res) => {
  try {
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const holidayData = normalizedHoliday(parsed.data);
    const rangeError = holidayRangeError(holidayData.date, holidayData.to || holidayData.date);
    if (rangeError) return res.status(400).json({ success: false, message: rangeError });
    const conflicts = await findHolidayConflicts(holidayData.date, holidayData.to || holidayData.date);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: "This range overlaps with holidays already on the calendar",
        conflictingDates: conflicts,
      });
    }
    const holiday = await holidayModel.create(holidayData);
    return res.status(201).json({ success: true, message: "Holiday added to the calendar", holiday });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "This holiday start date already exists on the calendar" });
    console.error("Create holiday failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateHoliday = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return notFound(res);
    const parsed = holidayUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const holiday = await holidayModel.findById(req.params.id);
    if (!holiday) return notFound(res);
    const normalized = normalizedHoliday({
      name: parsed.data.name ?? holiday.name,
      date: parsed.data.date ?? holiday.date,
      from: parsed.data.from,
      to: parsed.data.to ?? holiday.to,
      description: parsed.data.description ?? holiday.description,
    });
    const rangeError = holidayRangeError(normalized.date, normalized.to || normalized.date);
    if (rangeError) return res.status(400).json({ success: false, message: rangeError });
    const conflicts = await findHolidayConflicts(normalized.date, normalized.to || normalized.date, holiday._id);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: "This range overlaps with other holidays on the calendar",
        conflictingDates: conflicts,
      });
    }
    holiday.name = normalized.name;
    holiday.date = normalized.date;
    holiday.to = normalized.to;
    holiday.description = normalized.description;
    await holiday.save();
    return res.status(200).json({ success: true, message: "Holiday updated", holiday });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "A holiday already exists on this date" });
    console.error("Update holiday failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteHoliday = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return notFound(res);
    const holiday = await holidayModel.findByIdAndDelete(req.params.id);
    if (!holiday) return notFound(res);
    return res.status(200).json({ success: true, message: "Holiday deleted" });
  } catch (error) {
    console.error("Delete holiday failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
