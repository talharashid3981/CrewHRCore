import { z } from "zod";
import { isValidCalendarDate } from "../utils/calendar.js";
import { closeDays, recomputeSystemRows, resolveRange } from "../services/automationService.js";
import { addDays } from "../services/leaveService.js";

const rangeSchema = z.object({ from: z.string().refine(isValidCalendarDate), to: z.string().refine(isValidCalendarDate) }).strict();

export const dailyCloseController = async (req, res) => {
  if (!process.env.CRON_SECRET || req.get("x-cron-secret") !== process.env.CRON_SECRET) return res.status(401).json({ success: false, message: "Invalid cron secret" });
  try { return res.json({ success: true, result: await closeDays() }); }
  catch (error) { console.error("Daily close failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};

export const recomputeAttendanceController = async (req, res) => {
  const parsed = rangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid date range" });
  if (parsed.data.from > parsed.data.to) return res.status(400).json({ success: false, message: "from cannot be later than to" });
  if (parsed.data.to > addDays(parsed.data.from, 30)) return res.status(400).json({ success: false, message: "The recompute range cannot exceed 31 days" });
  try { return res.json({ success: true, result: await recomputeSystemRows(parsed.data.from, parsed.data.to) }); }
  catch (error) { console.error("Attendance recompute failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};

export const resolveAttendanceRangeController = async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Valid from and to dates are required" });
  if (parsed.data.from > parsed.data.to) return res.status(400).json({ success: false, message: "from cannot be later than to" });
  try { return res.json({ success: true, attendance: await resolveRange(req.params.employeeId, parsed.data.from, parsed.data.to) }); }
  catch (error) { console.error("Resolve attendance range failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};
