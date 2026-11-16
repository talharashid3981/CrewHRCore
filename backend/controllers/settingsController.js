import mongoose from "mongoose";
import { z } from "zod";
import officeSettingsModel from "../models/OfficeSettings.js";
import holidayModel from "../models/Holiday.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";

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
  date: z.string().refine(isValidCalendarDate, "Date must be a valid YYYY-MM-DD date"),
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

    const filter = { date: { $gte: from } };
    if (to) filter.date.$lte = to;
    const holidays = await holidayModel.find(filter).sort({ date: 1 });
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
    const holiday = await holidayModel.create(parsed.data);
    return res.status(201).json({ success: true, message: "Holiday added", holiday });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "A holiday already exists on this date" });
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
    Object.assign(holiday, parsed.data);
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
