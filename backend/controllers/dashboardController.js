import attendanceModel from "../models/Attendance.js";
import holidayModel from "../models/Holiday.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import userModel from "../models/User.js";
import { getLeaveBalances, addDays } from "../services/leaveService.js";
import { buildMonthlyReport, monthRange } from "../services/reportService.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { getResolutionContext, resolveRange, resolveRangeBulk } from "../services/automationService.js";

const employeeFilter = { role: "employee", onboardingStatus: "approved" };
const calendarMonth = (month) => typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? { from: `${month}-01`, to: month.endsWith("12") ? `${Number(month.slice(0, 4)) + 1}-01-01` : `${month.slice(0, 4)}-${String(Number(month.slice(5, 7)) + 1).padStart(2, "0")}-01` } : null;

export const dashboardToday = async (req, res) => {
  try {
    const date = getKarachiDateString();
    const employees = await userModel.find({ ...employeeFilter, isActive: true }).sort({ name: 1 }).lean();
    const rows = await resolveRangeBulk(employees, date, date);
    const [context, holiday, pendingOnboarding, pendingLeaveRequests, missingRows] = await Promise.all([
      getResolutionContext(date, date),
      holidayModel.findOne({ date }).select("name date").lean(),
      userModel.countDocuments({ role: "employee", onboardingStatus: "pending" }),
      leaveRequestModel.countDocuments({ status: "pending", employee: { $in: employees.map((employee) => employee._id) } }),
      attendanceModel.find({ date: { $gte: addDays(date, -6), $lte: date }, missingCheckOut: true }).populate("employee", "name email").lean(),
    ]);
    const todayRows = employees.map((employee) => ({ employee, resolved: rows.get(String(employee._id))?.[0] }));
    const checkedIn = todayRows.filter(({ resolved }) => ["present", "late"].includes(resolved?.status));
    const late = checkedIn.filter(({ resolved }) => resolved.status === "late");
    const onLeave = todayRows.filter(({ resolved }) => resolved?.status === "leave");
    const inOffice = checkedIn.filter(({ resolved }) => !resolved.attendance?.checkOut);
    const notCheckedInYet = todayRows.filter(({ resolved }) => resolved?.status === "pending");
    const dayType = context.holidays.has(date) ? "holiday" : context.weekendDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay()) ? "weekend" : "working";
    const lists = {
      late: late.map(({ employee, resolved }) => ({ id: employee._id, name: employee.name, lateMinutes: resolved.attendance?.lateMinutes || 0 })),
      onLeave: onLeave.map(({ employee }) => ({ id: employee._id, name: employee.name })),
      notCheckedInYet: notCheckedInYet.map(({ employee }) => ({ id: employee._id, name: employee.name })),
    };
    return res.json({ success: true, date, dayType, holiday: holiday ? { name: holiday.name, date: holiday.date } : null, expected: dayType === "working" ? employees.length : 0, checkedIn: dayType === "working" ? checkedIn.length : 0, late: dayType === "working" ? late.length : 0, inOffice: dayType === "working" ? inOffice.length : 0, onLeave: dayType === "working" ? onLeave.length : 0, notCheckedInYet: dayType === "working" ? notCheckedInYet.length : 0, pendingOnboarding, pendingLeaveRequests, missingCheckOuts: missingRows.length, missingCheckOutList: missingRows.map((row) => ({ id: row.employee?._id, name: row.employee?.name, date: row.date })), lists });
  } catch (error) { console.error("Dashboard today failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};

export const dashboardCalendar = async (req, res) => {
  const range = calendarMonth(req.query.month);
  if (!range) return res.status(400).json({ success: false, message: "month must be YYYY-MM" });
  const isAdmin = req.user.role === "admin";
  const filter = {
    status: isAdmin ? "approved" : { $in: ["approved", "pending"] },
    from: { $lt: range.to },
    to: { $gte: range.from },
  };
  if (!isAdmin) filter.employee = req.user._id;
  try {
    const [holidays, leaves, days] = await Promise.all([
      holidayModel.find({ date: { $gte: range.from, $lt: range.to } }).sort({ date: 1 }).lean(),
      leaveRequestModel.find(filter).populate("employee", "name").populate("leaveType", "name").sort({ from: 1 }).lean(),
      isAdmin ? Promise.resolve([]) : resolveRange(req.user._id, range.from, addDays(range.to, -1)),
    ]);
    const events = [
      ...holidays.map((holiday) => ({ id: `h-${holiday._id}`, title: holiday.name, start: holiday.date, allDay: true, type: "holiday" })),
      ...leaves.map((leave) => ({
        id: `l-${leave._id}`,
        title: isAdmin ? `${leave.employee?.name || "Employee"} - ${leave.leaveType?.name || "Leave"}` : leave.leaveType?.name || "Leave",
        start: leave.from,
        end: addDays(leave.to, 1),
        to: leave.to,
        days: leave.days,
        allDay: true,
        type: "leave",
        status: leave.status,
      })),
    ];
    const attendanceDays = days.map(({ date, status, attendance }) => ({
      date,
      status,
      attendance: attendance
        ? {
            status: attendance.status,
            checkIn: attendance.checkIn,
            checkOut: attendance.checkOut,
            workedMinutes: attendance.workedMinutes,
            lateMinutes: attendance.lateMinutes,
          }
        : null,
    }));
    return res.json({ success: true, month: req.query.month, events, days: attendanceDays });
  } catch (error) { console.error("Dashboard calendar failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};

export const dashboardMe = async (req, res) => {
  try {
    const date = getKarachiDateString();
    const month = date.slice(0, 7);
    const range = monthRange(month);
    const employee = await userModel.findById(req.user._id).lean();
    const [report, balances, holidays, leaves] = await Promise.all([
      buildMonthlyReport([employee], range),
      getLeaveBalances(req.user._id, Number(month.slice(0, 4))),
      holidayModel.find({ date: { $gte: addDays(date, 1) } }).sort({ date: 1 }).limit(3).lean(),
      leaveRequestModel.find({ employee: req.user._id, status: "approved", to: { $gte: date } }).populate("leaveType", "name").sort({ from: 1 }).limit(3).lean(),
    ]);
    const [monthly] = report;
    const todayRow = monthly?.daily.find((day) => day.date === date);
    return res.json({ success: true, date, today: todayRow || { date, status: "pending", attendance: null }, month, summary: monthly?.summary, balances, upcomingHolidays: holidays, upcomingLeaves: leaves });
  } catch (error) { console.error("Dashboard me failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};
