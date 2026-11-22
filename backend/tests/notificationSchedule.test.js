import test from "node:test";
import assert from "node:assert/strict";
import {
  isWeeklySummaryWindow,
  isWithinReminderWindow,
  previousWeekRange,
} from "../utils/notificationSchedule.js";
import {
  defaultNotificationPreferences,
  normalizeNotificationPreferences,
} from "../utils/notificationPreferences.js";
import userModel from "../models/User.js";

test("computes the previous Monday-to-Sunday summary range", () => {
  assert.deepEqual(previousWeekRange("2026-11-23"), {
    from: "2026-11-16",
    to: "2026-11-22",
  });
});

test("attendance reminder window includes its start and excludes its end", () => {
  assert.equal(isWithinReminderWindow(555, 555), true);
  assert.equal(isWithinReminderWindow(569, 555), true);
  assert.equal(isWithinReminderWindow(570, 555), false);
  assert.equal(isWithinReminderWindow(554, 555), false);
});

test("weekly summary sends on Monday during its retry window only", () => {
  assert.equal(isWeeklySummaryWindow({ dateKey: "2026-11-23", hour: 9, minute: 0 }), true);
  assert.equal(isWeeklySummaryWindow({ dateKey: "2026-11-23", hour: 9, minute: 14 }), true);
  assert.equal(isWeeklySummaryWindow({ dateKey: "2026-11-23", hour: 9, minute: 15 }), false);
  assert.equal(isWeeklySummaryWindow({ dateKey: "2026-11-24", hour: 9, minute: 0 }), false);
});

test("legacy users receive the configured email preference defaults", () => {
  assert.deepEqual(normalizeNotificationPreferences(undefined), defaultNotificationPreferences);
  assert.deepEqual(normalizeNotificationPreferences({ weeklySummary: true }), {
    leaveUpdates: true,
    attendanceReminders: true,
    weeklySummary: true,
  });
});

test("new user documents default to email updates and attendance reminders", () => {
  const user = new userModel({
    name: "Test Employee",
    email: "test@example.com",
    password: "a-secure-test-password",
  });
  assert.deepEqual(user.notificationPreferences.toObject(), defaultNotificationPreferences);
});
