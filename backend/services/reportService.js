import { addDays } from "./leaveService.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { resolveRangeBulk } from "./automationService.js";

export const monthRange = (month) => {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const from = `${month}-01`;
  const nextMonth = month.endsWith("12") ? `${Number(month.slice(0, 4)) + 1}-01-01` : `${month.slice(0, 4)}-${String(Number(month.slice(5, 7)) + 1).padStart(2, "0")}-01`;
  const last = addDays(nextMonth, -1);
  const today = getKarachiDateString();
  if (from > today) return { month, from, to: null, dates: [] };
  const to = last < today ? last : today;
  const dates = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return { month, from, to, dates };
};

export const summarizeResolved = (dailyRows) => {
  const summary = { present: 0, late: 0, absent: 0, leave: 0, holidays: 0, workingDays: 0, attendancePercent: 0, totalLateMinutes: 0, workedHours: 0, missingCheckOuts: 0 };
  for (const day of dailyRows) {
    if (["present", "late", "absent", "leave"].includes(day.status)) summary.workingDays += 1;
    if (day.status === "present") summary.present += 1;
    if (day.status === "late") summary.late += 1;
    if (day.status === "absent") summary.absent += 1;
    if (day.status === "leave") summary.leave += 1;
    if (day.status === "holiday") summary.holidays += 1;
    summary.totalLateMinutes += day.attendance?.lateMinutes || 0;
    summary.workedHours += (day.attendance?.workedMinutes || 0) / 60;
    if (day.attendance?.missingCheckOut) summary.missingCheckOuts += 1;
  }
  const denominator = summary.present + summary.late + summary.absent;
  summary.attendancePercent = denominator ? Number((((summary.present + summary.late) / denominator) * 100).toFixed(2)) : 0;
  summary.workedHours = Number(summary.workedHours.toFixed(2));
  return summary;
};

export const buildMonthlyReport = async (employees, range) => {
  if (!range || !isValidCalendarDate(range.from) || !range.to) return [];
  const resolved = await resolveRangeBulk(employees, range.from, range.to);
  return employees.map((employee) => {
    const daily = resolved.get(String(employee._id)) || [];
    return { employee: { id: employee._id, name: employee.name, email: employee.email, department: employee.department, designation: employee.designation }, summary: summarizeResolved(daily), daily };
  });
};
