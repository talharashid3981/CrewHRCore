import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { z } from "zod";
import userModel from "../models/User.js";
import { getLeaveBalances } from "../services/leaveService.js";
import { buildMonthlyReport, monthRange, summarizeResolved } from "../services/reportService.js";
import { getKarachiDateString } from "../utils/calendar.js";
import { addDays } from "../services/leaveService.js";

const employeesFilter = { role: "employee", onboardingStatus: "approved" };
const monthOrError = (value) => monthRange(value) || null;
const escapeExcelText = (value = "") => {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};
const employeeIdError = (res) => res.status(400).json({ success: false, message: "Invalid employee id" });
const excelColumn = (number) => {
  let value = number;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const getReportEmployees = async ({ department, search } = {}) => {
  const filter = { ...employeesFilter };
  if (department?.trim()) filter.department = department.trim();
  if (search?.trim()) {
    const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }];
  }
  return userModel.find(filter).sort({ name: 1 }).lean();
};

export const monthlyReport = async (req, res) => {
  const range = monthOrError(req.query.month);
  if (!range) return res.status(400).json({ success: false, message: "month must be YYYY-MM" });
  const employees = await getReportEmployees(req.query);
  const reports = await buildMonthlyReport(employees, range);
  return res.json({ success: true, month: range.month, from: range.from, to: range.to, reports });
};

export const employeeMonthlyDetail = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.employeeId)) return employeeIdError(res);
  const range = monthOrError(req.query.month);
  if (!range) return res.status(400).json({ success: false, message: "month must be YYYY-MM" });
  if (req.user.role !== "admin" && String(req.user._id) !== req.params.employeeId) return res.status(403).json({ success: false, message: "Forbidden" });
  const employee = await userModel.findOne({ _id: req.params.employeeId, role: "employee" }).lean();
  if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
  const [report] = await buildMonthlyReport([employee], range);
  return res.json({ success: true, month: range.month, employee: report.employee, summary: report.summary, daily: report.daily.map((day) => ({ date: day.date, status: day.status, checkIn: day.attendance?.checkIn || null, checkOut: day.attendance?.checkOut || null, lateByMinutes: day.attendance?.lateMinutes || 0, workedMinutes: day.attendance?.workedMinutes || 0, missingCheckOut: Boolean(day.attendance?.missingCheckOut) })) });
};

export const exportMonthly = async (req, res) => {
  const range = monthOrError(req.query.month);
  if (!range) return res.status(400).json({ success: false, message: "month must be YYYY-MM" });
  try {
    const employees = await getReportEmployees(req.query);
    const reports = await buildMonthlyReport(employees, range);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Crew HRCore";
    const summary = workbook.addWorksheet("Summary");
    summary.mergeCells("A1:M1");
    summary.getCell("A1").value = `Crew HRCore - Attendance Report - ${range.month}`;
    summary.getCell("A2").value = `Generated on: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date())} (Asia/Karachi)`;
    summary.addRow([]);
    summary.addRow(["Employee", "Email", "Department", "Present", "Late", "Absent", "Leave", "Holidays", "Working Days", "Attendance %", "Late Minutes", "Worked Hours", "Missing Check-outs"]);
    const header = summary.getRow(4);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    for (const report of reports) summary.addRow([escapeExcelText(report.employee.name), escapeExcelText(report.employee.email), escapeExcelText(report.employee.department), report.summary.present, report.summary.late, report.summary.absent, report.summary.leave, report.summary.holidays, report.summary.workingDays, report.summary.attendancePercent / 100, report.summary.totalLateMinutes, report.summary.workedHours, report.summary.missingCheckOuts]);
    summary.getColumn(10).numFmt = "0.00%";
    summary.views = [{ state: "frozen", ySplit: 4 }];
    summary.autoFilter = "A4:M4";
    summary.columns.forEach((column) => { column.width = Math.max(14, Math.min(28, column.header?.length + 3 || 14)); });
    const grid = workbook.addWorksheet("Daily Grid");
    const dates = range.dates;
    grid.addRow(["Employee", ...dates]);
    grid.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
    grid.autoFilter = `A1:${excelColumn(dates.length + 1)}${reports.length + 1}`;
    grid.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    grid.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    const code = { present: "P", late: "L", absent: "A", leave: "LV", holiday: "H", weekend: "W", pending: "-", notEligible: "-" };
    reports.forEach((report) => {
      const row = grid.addRow([escapeExcelText(report.employee.name), ...report.daily.map((day) => code[day.status] || "-")]);
      report.daily.forEach((day, index) => {
        const cell = row.getCell(index + 2);
        const colors = { P: "FFC6EFCE", L: "FFFFEB9C", A: "FFFFC7CE", LV: "FFBDD7EE", H: "FFE7E6E6", W: "FFE7E6E6" };
        if (colors[cell.value]) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors[cell.value] } };
      });
    });
    grid.getColumn(1).width = 28;
    for (let index = 2; index <= dates.length + 1; index += 1) grid.getColumn(index).width = 12;
    const legend = workbook.addWorksheet("Legend");
    legend.addRows([["Code", "Meaning"], ["P", "Present"], ["L", "Late"], ["A", "Absent"], ["LV", "Leave"], ["H", "Holiday"], ["W", "Weekend"], ["-", "Pending / not eligible"]]);
    res.status(200);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${range.month}.xlsx"`);
    res.setHeader("Cache-Control", "no-store");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { console.error("Export monthly report failed:", error); if (!res.headersSent) res.status(500).json({ success: false, message: "Internal server error" }); }
};
