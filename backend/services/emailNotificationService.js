import attendanceModel from "../models/Attendance.js";
import emailNotificationDeliveryModel from "../models/EmailNotificationDelivery.js";
import leaveRequestModel from "../models/LeaveRequest.js";
import officeSettingsModel from "../models/OfficeSettings.js";
import userModel from "../models/User.js";
import {
  sendCheckInReminderEmail,
  sendCheckOutReminderEmail,
  sendWeeklySummaryEmail,
} from "../utils/emailService.js";
import {
  getHolidaySet,
  isWeekend,
  toKarachiMoment,
} from "../utils/attendanceHelpers.js";
import {
  addCalendarDays,
  isWeeklySummaryWindow,
  isWithinReminderWindow,
  previousWeekRange,
} from "../utils/notificationSchedule.js";

const reminderWindowMinutes = 15;
const deliveryLeaseMs = 2 * 60 * 1000;

const parseTime = (time) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const claimDelivery = async (employee, kind, periodKey) => {
  const identity = { employee: employee._id, kind, periodKey };
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + deliveryLeaseMs);
  const retryable = await emailNotificationDeliveryModel.findOneAndUpdate(
    {
      ...identity,
      $or: [
        { status: "failed" },
        { status: "sending", leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: { status: "sending", leaseExpiresAt },
      $unset: { lastError: 1, sentAt: 1 },
    },
    { new: true },
  );
  if (retryable) return retryable;

  try {
    return await emailNotificationDeliveryModel.create({
      ...identity,
      status: "sending",
      leaseExpiresAt,
    });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

const sendOnce = async (employee, kind, periodKey, send) => {
  const delivery = await claimDelivery(employee, kind, periodKey);
  if (!delivery) return false;

  try {
    await send();
    await emailNotificationDeliveryModel.updateOne(
      { _id: delivery._id, status: "sending" },
      {
        $set: { status: "sent", sentAt: new Date() },
        $unset: { leaseExpiresAt: 1, lastError: 1 },
      },
    );
    return true;
  } catch (error) {
    await emailNotificationDeliveryModel.updateOne(
      { _id: delivery._id, status: "sending" },
      {
        $set: {
          status: "failed",
          leaseExpiresAt: new Date(0),
          lastError: String(error?.message || error).slice(0, 500),
        },
      },
    );
    throw error;
  }
};

const sendWithLogging = async (employee, kind, periodKey, send) => {
  try {
    await sendOnce(employee, kind, periodKey, send);
  } catch (error) {
    console.error(`${kind} email failed for employee ${employee._id}:`, error.message);
  }
};

export const runAttendanceReminderEmails = async (now = new Date()) => {
  const moment = toKarachiMoment(now);
  const { dateKey, totalMinutes } = moment;
  const settings = await officeSettingsModel.findOne({ key: "default" })
    .select("graceMinutes weekendDays")
    .lean();
  if (isWeekend(dateKey, settings?.weekendDays || [0, 6])) return;
  if ((await getHolidaySet([dateKey])).has(dateKey)) return;

  const employees = await userModel.find({
    role: "employee",
    isActive: true,
    onboardingStatus: "approved",
    $or: [
      { "notificationPreferences.attendanceReminders": true },
      { "notificationPreferences.attendanceReminders": { $exists: false } },
    ],
  }).select("name email shiftStart shiftEnd").lean();
  if (!employees.length) return;

  const employeeIds = employees.map((employee) => employee._id);
  const [attendance, approvedLeaves] = await Promise.all([
    attendanceModel.find({ employee: { $in: employeeIds }, date: dateKey })
      .select("employee checkIn checkOut status")
      .lean(),
    leaveRequestModel.find({
      employee: { $in: employeeIds },
      status: "approved",
      from: { $lte: dateKey },
      to: { $gte: dateKey },
    }).select("employee").lean(),
  ]);
  const attendanceByEmployee = new Map(
    attendance.map((record) => [String(record.employee), record]),
  );
  const employeesOnLeave = new Set(approvedLeaves.map((leave) => String(leave.employee)));
  const graceMinutes = settings?.graceMinutes ?? 15;

  await Promise.all(employees.map(async (employee) => {
    const employeeId = String(employee._id);
    if (employeesOnLeave.has(employeeId)) return;

    const record = attendanceByEmployee.get(employeeId);
    const shiftStart = parseTime(employee.shiftStart);
    const shiftEnd = parseTime(employee.shiftEnd);
    if (shiftStart === null || shiftEnd === null) return;

    const checkInDue = shiftStart + graceMinutes;
    if (
      checkInDue < 1440
      && !record?.checkIn
      && !["absent", "leave", "holiday"].includes(record?.status)
      && isWithinReminderWindow(totalMinutes, checkInDue, reminderWindowMinutes)
    ) {
      await sendWithLogging(employee, "check-in-reminder", dateKey, () =>
        sendCheckInReminderEmail(employee, dateKey, employee.shiftStart));
      return;
    }

    if (
      record?.checkIn
      && !record.checkOut
      && isWithinReminderWindow(totalMinutes, shiftEnd, reminderWindowMinutes)
    ) {
      await sendWithLogging(employee, "check-out-reminder", dateKey, () =>
        sendCheckOutReminderEmail(employee, dateKey, employee.shiftEnd));
    }
  }));
};

const karachiMidnightUtc = (dateKey) => new Date(`${dateKey}T00:00:00.000+05:00`);

const getWeeklyActivity = async (employeeIds, range) => {
  const nextWeek = addCalendarDays(range.to, 1);
  const createdAtFrom = karachiMidnightUtc(range.from);
  const createdAtUntil = karachiMidnightUtc(nextWeek);
  const [attendanceRows, leaveRows] = await Promise.all([
    attendanceModel.aggregate([
      { $match: { employee: { $in: employeeIds }, date: { $gte: range.from, $lte: range.to } } },
      {
        $group: {
          _id: "$employee",
          daysAttended: {
            $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] },
          },
          lateDays: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          workedMinutes: { $sum: { $ifNull: ["$workedMinutes", 0] } },
          leaveDays: { $sum: { $ifNull: ["$leaveDays", 0] } },
        },
      },
    ]),
    leaveRequestModel.aggregate([
      {
        $match: {
          employee: { $in: employeeIds },
          createdAt: { $gte: createdAtFrom, $lt: createdAtUntil },
        },
      },
      {
        $group: {
          _id: "$employee",
          leaveRequestsSubmitted: { $sum: 1 },
          leaveRequestsApproved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          leaveRequestsRejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  return {
    attendanceByEmployee: new Map(attendanceRows.map((row) => [String(row._id), row])),
    leaveByEmployee: new Map(leaveRows.map((row) => [String(row._id), row])),
  };
};

export const runWeeklySummaryEmails = async (now = new Date()) => {
  const moment = toKarachiMoment(now);
  if (!isWeeklySummaryWindow(moment)) return;

  const employees = await userModel.find({
    role: "employee",
    isActive: true,
    onboardingStatus: "approved",
    "notificationPreferences.weeklySummary": true,
  }).select("name email").lean();
  if (!employees.length) return;

  const range = previousWeekRange(moment.dateKey);
  const ids = employees.map((employee) => employee._id);
  const { attendanceByEmployee, leaveByEmployee } = await getWeeklyActivity(ids, range);

  await Promise.all(employees.map((employee) => {
    const attendance = attendanceByEmployee.get(String(employee._id)) || {};
    const leave = leaveByEmployee.get(String(employee._id)) || {};
    const summary = {
      daysAttended: attendance.daysAttended || 0,
      lateDays: attendance.lateDays || 0,
      workedMinutes: attendance.workedMinutes || 0,
      leaveDays: attendance.leaveDays || 0,
      leaveRequestsSubmitted: leave.leaveRequestsSubmitted || 0,
      leaveRequestsApproved: leave.leaveRequestsApproved || 0,
      leaveRequestsRejected: leave.leaveRequestsRejected || 0,
    };
    return sendWithLogging(employee, "weekly-summary", range.from, () =>
      sendWeeklySummaryEmail(employee, range, summary));
  }));
};
