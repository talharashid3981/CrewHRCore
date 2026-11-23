import attendanceModel from "../models/Attendance.js";
import automationStateModel from "../models/AutomationState.js";
import holidayModel from "../models/Holiday.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import userModel from "../models/User.js";
import { getLeaveBalances, getCurrentLeaveYear, addDays } from "../services/leaveService.js";
import { buildMonthlyReport, monthRange } from "../services/reportService.js";
import { getKarachiDateString, isValidCalendarDate } from "../utils/calendar.js";
import { getResolutionContext, resolveRange, resolveRangeBulk } from "../services/automationService.js";
import { holidayOnDateQuery, holidayRangeQuery } from "../utils/holidayCalendar.js";

const employeeFilter = { role: "employee", onboardingStatus: "approved" };
const calendarMonth = (month) => typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? { from: `${month}-01`, to: month.endsWith("12") ? `${Number(month.slice(0, 4)) + 1}-01-01` : `${month.slice(0, 4)}-${String(Number(month.slice(5, 7)) + 1).padStart(2, "0")}-01` } : null;

export const dashboardAdmin = async (req, res) => {
  try {
    const date = getKarachiDateString();
    const monthStart = new Date(`${date.slice(0, 7)}-01T00:00:00+05:00`);
    const activityStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const attendanceFrom = addDays(date, -6);
    const employeeFilter = { role: "employee" };
    const activeEmployeeFilter = { ...employeeFilter, isActive: true };
    const [activeEmployees, activeEmployeeIds] = await Promise.all([
      userModel.find({
        ...activeEmployeeFilter,
        onboardingStatus: "approved",
      }).select("_id name profilePic department joiningDate approvedAt shiftStart shiftEnd").lean(),
      userModel.find(activeEmployeeFilter).distinct("_id"),
    ]);

    const [
      totalEmployees,
      statusCounts,
      newThisMonth,
      pendingProfiles,
      pendingLeaves,
      pendingLeaveCount,
      missingCheckOutCount,
      missingCheckOuts,
      attendanceDays,
      automationState,
      reviewStats,
      recentProfiles,
      recentLeaves,
      recentAttendance,
    ] = await Promise.all([
      userModel.countDocuments({ role: "employee" }),
      userModel.aggregate([
        { $match: { role: "employee" } },
        { $group: { _id: "$onboardingStatus", count: { $sum: 1 } } },
      ]),
      userModel.countDocuments({ ...employeeFilter, createdAt: { $gte: monthStart } }),
      userModel.find({
        ...employeeFilter,
        onboardingStatus: "pending",
        onboardingSubmittedAt: { $exists: true, $type: "date" },
      }).select("name onboardingSubmittedAt").sort({ onboardingSubmittedAt: 1 }).limit(1).lean(),
      leaveRequestModel.find({ employee: { $in: activeEmployeeIds }, status: "pending" })
        .select("_id createdAt").sort({ createdAt: 1 }).limit(1).lean(),
      leaveRequestModel.countDocuments({ employee: { $in: activeEmployeeIds }, status: "pending" }),
      attendanceModel.countDocuments({
        date: { $gte: attendanceFrom, $lte: date },
        missingCheckOut: true,
      }),
      attendanceModel.find({
        date: { $gte: attendanceFrom, $lte: date },
        missingCheckOut: true,
      }).populate("employee", "name profilePic").select("date employee").sort({ date: 1 }).limit(20).lean(),
      resolveRangeBulk(activeEmployees, date, date),
      automationStateModel.findOne({ key: "dailyClose" }).select("updatedAt lastProcessedDate").lean(),
      userModel.aggregate([
        {
          $match: {
            ...employeeFilter,
            onboardingStatus: "approved",
            onboardingSubmittedAt: { $exists: true },
            approvedAt: { $exists: true },
            $expr: { $gte: ["$approvedAt", "$onboardingSubmittedAt"] },
          },
        },
        { $project: { duration: { $subtract: ["$approvedAt", "$onboardingSubmittedAt"] } } },
        { $group: { _id: null, averageDuration: { $avg: "$duration" } } },
      ]),
      userModel.find({
        ...employeeFilter,
        $or: [
          { onboardingSubmittedAt: { $gte: activityStart } },
          { approvedAt: { $gte: activityStart } },
          { onboardingStatus: "rejected", updatedAt: { $gte: activityStart } },
        ],
      }).select("name profilePic onboardingStatus onboardingSubmittedAt approvedAt rejectionNote updatedAt").sort({ updatedAt: -1 }).limit(8).lean(),
      leaveRequestModel.find({
        employee: { $in: activeEmployeeIds },
        $or: [
          { createdAt: { $gte: activityStart } },
          { reviewedAt: { $gte: activityStart } },
        ],
      }).populate("employee", "name profilePic").populate("leaveType", "name")
        .select("employee leaveType status days createdAt reviewedAt").sort({ updatedAt: -1 }).limit(8).lean(),
      attendanceModel.find({
        date: { $gte: attendanceFrom, $lte: date },
        checkIn: { $exists: true },
      }).populate("employee", "name profilePic")
        .select("employee status date checkIn lateMinutes").sort({ checkIn: -1 }).limit(8).lean(),
    ]);

    const counts = Object.fromEntries(statusCounts.map(({ _id, count }) => [_id, count]));
    const todayRows = activeEmployees.map((employee) => ({
      employee,
      resolved: attendanceDays.get(String(employee._id))?.[0],
    }));
    const eligibleTodayRows = todayRows.filter(({ resolved }) => resolved?.status !== "notEligible");
    const checkedInRows = eligibleTodayRows.filter(({ resolved }) =>
      ["present", "late"].includes(resolved?.status),
    );
    const lateRows = eligibleTodayRows.filter(({ resolved }) => resolved?.status === "late");
    const absentRows = eligibleTodayRows.filter(({ resolved }) => resolved?.status === "absent");
    const onLeaveRows = eligibleTodayRows.filter(({ resolved }) => resolved?.status === "leave");
    const notCheckedInRows = eligibleTodayRows.filter(({ resolved }) => resolved?.status === "pending");
    const expectedRows = eligibleTodayRows.filter(({ resolved }) =>
      ["present", "late", "absent", "pending"].includes(resolved?.status),
    );
    const [context, holiday] = await Promise.all([
      getResolutionContext(date, date),
      holidayModel.findOne(holidayOnDateQuery(date)).select("name date to").lean(),
    ]);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const dayType = context.holidays.has(date)
      ? "holiday"
      : context.weekendDays.includes(weekday)
        ? "weekend"
        : "working";
    const expected = dayType === "working" ? expectedRows.length : 0;
    const departmentMap = new Map();
    for (const { employee, resolved } of expectedRows) {
      const name = employee.department;
      if (!name) continue;
      const department = departmentMap.get(name) || { name, total: 0, checkedIn: 0 };
      department.total += 1;
      if (["present", "late"].includes(resolved?.status)) department.checkedIn += 1;
      departmentMap.set(name, department);
    }

    const averageReviewDays = reviewStats[0]?.averageDuration !== undefined
      ? Number((reviewStats[0].averageDuration / (24 * 60 * 60 * 1000)).toFixed(1))
      : null;
    const oldestPendingProfile = pendingProfiles[0];
    const oldestPendingLeave = pendingLeaves[0];
    const daysSince = (value) => value
      ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000)))
      : null;

    const activities = [];
    for (const profile of recentProfiles) {
      if (profile.onboardingSubmittedAt && profile.onboardingSubmittedAt >= activityStart) {
        activities.push({
          id: `onboarding-${profile._id}`,
          kind: "onboarding",
          name: profile.name,
          title: `${profile.name} submitted onboarding`,
          profilePic: profile.profilePic,
          detail: "Pending review",
          timestamp: profile.onboardingSubmittedAt,
        });
      }
      if (profile.approvedAt && profile.approvedAt >= activityStart) {
        activities.push({
          id: `approved-${profile._id}`,
          kind: "approved",
          name: profile.name,
          title: `${profile.name} profile approved`,
          profilePic: profile.profilePic,
          detail: "Employee is ready for attendance",
          timestamp: profile.approvedAt,
        });
      }
      if (profile.onboardingStatus === "rejected" && profile.updatedAt >= activityStart) {
        activities.push({
          id: `rejected-${profile._id}`,
          kind: "rejected",
          name: profile.name,
          title: `${profile.name} profile needs changes`,
          profilePic: profile.profilePic,
          detail: profile.rejectionNote || "Returned for updates",
          timestamp: profile.updatedAt,
        });
      }
    }
    for (const leave of recentLeaves) {
      if (leave.createdAt >= activityStart) {
        activities.push({
          id: `leave-${leave._id}`,
          kind: "leave",
          name: leave.employee?.name || "Employee",
          title: `${leave.employee?.name || "Employee"} requested ${leave.leaveType?.name || "leave"}`,
          profilePic: leave.employee?.profilePic,
          detail: `${leave.status} · ${leave.days} working day${leave.days === 1 ? "" : "s"}`,
          timestamp: leave.createdAt,
        });
      }
      if (leave.reviewedAt && leave.reviewedAt >= activityStart) {
        activities.push({
          id: `leave-review-${leave._id}`,
          kind: leave.status === "approved" ? "approved" : "rejected",
          name: leave.employee?.name || "Employee",
          title: `Leave ${leave.status} for ${leave.employee?.name || "employee"}`,
          profilePic: leave.employee?.profilePic,
          detail: `${leave.leaveType?.name || "Leave"} · ${leave.days} working day${leave.days === 1 ? "" : "s"}`,
          timestamp: leave.reviewedAt,
        });
      }
    }
    for (const record of recentAttendance) {
      activities.push({
        id: `attendance-${record._id}`,
        kind: record.status === "late" ? "late" : "attendance",
        name: record.employee?.name || "Employee",
        title: `${record.employee?.name || "Employee"} checked in`,
        profilePic: record.employee?.profilePic,
        detail: record.status === "late"
          ? `Late · ${record.lateMinutes || 0} minutes`
          : `On time · ${record.date}`,
        timestamp: record.checkIn,
      });
    }
    activities.sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

    return res.json({
      success: true,
      date,
      dayType,
      holiday: holiday ? { name: holiday.name, date: holiday.date } : null,
      summary: {
        total: totalEmployees,
        active: activeEmployees.length,
        pending: counts.pending || 0,
        approved: counts.approved || 0,
        incomplete: counts.incomplete || 0,
        rejected: counts.rejected || 0,
        newThisMonth,
        pendingLeaves: pendingLeaveCount,
      },
      attendance: {
        expected,
        checkedIn: dayType === "working" ? checkedInRows.length : 0,
        present: dayType === "working"
          ? checkedInRows.filter(({ resolved }) => resolved.status === "present").length
          : 0,
        late: dayType === "working" ? lateRows.length : 0,
        absent: dayType === "working" ? absentRows.length : 0,
        notCheckedIn: dayType === "working" ? notCheckedInRows.length : 0,
        onLeave: dayType === "working" ? onLeaveRows.length : 0,
        holiday: holiday?.name || null,
      },
      onboarding: {
        total: totalEmployees,
        approved: counts.approved || 0,
        pending: counts.pending || 0,
        incomplete: counts.incomplete || 0,
        rejected: counts.rejected || 0,
        averageReviewDays,
        oldestPendingDays: daysSince(oldestPendingProfile?.onboardingSubmittedAt),
      },
      alerts: {
        pendingProfiles: counts.pending || 0,
        oldestPendingProfileDays: daysSince(oldestPendingProfile?.onboardingSubmittedAt),
        pendingLeaves: pendingLeaveCount,
        oldestPendingLeaveDays: daysSince(oldestPendingLeave?.createdAt),
        missingCheckOuts: missingCheckOutCount,
        missingCheckOutList: missingCheckOuts.slice(0, 5).map((record) => ({
          id: record._id,
          name: record.employee?.name || "Employee",
          date: record.date,
        })),
      },
      departments: [...departmentMap.values()]
        .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name))
        .slice(0, 8),
      activities: activities.slice(0, 20),
      automation: automationState
        ? { lastRunAt: automationState.updatedAt, lastProcessedDate: automationState.lastProcessedDate }
        : null,
    });
  } catch (error) {
    console.error("Admin dashboard failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const dashboardToday = async (req, res) => {
  try {
    const date = getKarachiDateString();
    const employees = await userModel.find({ ...employeeFilter, isActive: true }).sort({ name: 1 }).lean();
    const rows = await resolveRangeBulk(employees, date, date);
    const [context, holiday, pendingOnboarding, pendingLeaveRequests, missingRows] = await Promise.all([
      getResolutionContext(date, date),
      holidayModel.findOne(holidayOnDateQuery(date)).select("name date to").lean(),
      userModel.countDocuments({ role: "employee", onboardingStatus: "pending" }),
      leaveRequestModel.countDocuments({ status: "pending", employee: { $in: employees.map((employee) => employee._id) } }),
      attendanceModel.find({ date: { $gte: addDays(date, -6), $lte: date }, missingCheckOut: true }).populate("employee", "name email").lean(),
    ]);
    const todayRows = employees.map((employee) => ({ employee, resolved: rows.get(String(employee._id))?.[0] }));
    const eligibleTodayRows = todayRows.filter(({ resolved }) => resolved?.status !== "notEligible");
    const checkedIn = eligibleTodayRows.filter(({ resolved }) => ["present", "late"].includes(resolved?.status));
    const late = checkedIn.filter(({ resolved }) => resolved.status === "late");
    const absent = eligibleTodayRows.filter(({ resolved }) => resolved?.status === "absent");
    const onLeave = eligibleTodayRows.filter(({ resolved }) => resolved?.status === "leave");
    const inOffice = checkedIn.filter(({ resolved }) => !resolved.attendance?.checkOut);
    const notCheckedInYet = eligibleTodayRows.filter(({ resolved }) => resolved?.status === "pending");
    const expectedRows = eligibleTodayRows.filter(({ resolved }) =>
      ["present", "late", "absent", "pending"].includes(resolved?.status),
    );
    const dayType = context.holidays.has(date) ? "holiday" : context.weekendDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay()) ? "weekend" : "working";
    const lists = {
      late: late.map(({ employee, resolved }) => ({ id: employee._id, name: employee.name, lateMinutes: resolved.attendance?.lateMinutes || 0 })),
      absent: absent.map(({ employee }) => ({ id: employee._id, name: employee.name })),
      onLeave: onLeave.map(({ employee }) => ({ id: employee._id, name: employee.name })),
      notCheckedInYet: notCheckedInYet.map(({ employee }) => ({ id: employee._id, name: employee.name })),
    };
    return res.json({ success: true, date, dayType, holiday: holiday ? { name: holiday.name, date: holiday.date } : null, expected: dayType === "working" ? expectedRows.length : 0, checkedIn: dayType === "working" ? checkedIn.length : 0, late: dayType === "working" ? late.length : 0, absent: dayType === "working" ? absent.length : 0, inOffice: dayType === "working" ? inOffice.length : 0, onLeave: dayType === "working" ? onLeave.length : 0, notCheckedInYet: dayType === "working" ? notCheckedInYet.length : 0, pendingOnboarding, pendingLeaveRequests, missingCheckOuts: missingRows.length, missingCheckOutList: missingRows.map((row) => ({ id: row.employee?._id, name: row.employee?.name, date: row.date })), lists });
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
      holidayModel.find(holidayRangeQuery(range.from, addDays(range.to, -1))).sort({ date: 1 }).lean(),
      leaveRequestModel.find(filter).populate("employee", "name").populate("leaveType", "name").sort({ from: 1 }).lean(),
      isAdmin ? Promise.resolve([]) : resolveRange(req.user._id, range.from, addDays(range.to, -1)),
    ]);
    const events = [
      ...holidays.map((holiday) => ({ id: `h-${holiday._id}`, title: holiday.name, start: holiday.date, end: addDays(holiday.to || holiday.date, 1), to: holiday.to || holiday.date, allDay: true, type: "holiday" })),
      ...leaves.map((leave) => ({
        id: `l-${leave._id}`,
        title: isAdmin ? `${leave.employee?.name || "Employee"} - ${leave.leaveType?.name || "Leave"}` : leave.leaveType?.name || "Leave",
        start: leave.from,
        end: addDays(leave.to, 1),
        to: leave.to,
        days: leave.days,
        duration: leave.duration,
        halfDayPeriod: leave.halfDayPeriod || null,
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
            leaveDays: attendance.leaveDays || 0,
            leavePeriod: attendance.leavePeriod || null,
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
    const leaveYear = await getCurrentLeaveYear(date);
    const employee = await userModel.findById(req.user._id).lean();
    const [report, balances, holidays, leaves] = await Promise.all([
      buildMonthlyReport([employee], range),
      getLeaveBalances(req.user._id, leaveYear),
      holidayModel.find({
        $or: [
          { date: { $gte: date } },
          { date: { $lt: date }, to: { $gte: date } },
        ],
      }).sort({ date: 1 }).limit(3).lean(),
      leaveRequestModel.find({ employee: req.user._id, status: "approved", to: { $gte: date } }).populate("leaveType", "name").sort({ from: 1 }).limit(3).lean(),
    ]);
    const [monthly] = report;
    const todayRow = monthly?.daily.find((day) => day.date === date);
    return res.json({ success: true, date, today: todayRow || { date, status: "pending", attendance: null }, month, summary: monthly?.summary, balances, upcomingHolidays: holidays, upcomingLeaves: leaves });
  } catch (error) { console.error("Dashboard me failed:", error); return res.status(500).json({ success: false, message: "Internal server error" }); }
};
