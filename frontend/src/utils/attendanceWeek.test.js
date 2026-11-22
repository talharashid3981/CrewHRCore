import test from "node:test";
import assert from "node:assert/strict";
import { getAttendanceWeekDates } from "./attendanceWeek.js";

test("returns Monday through Sunday for a Sunday in the current week", () => {
  assert.deepEqual(getAttendanceWeekDates("2026-11-22"), [
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ]);
});

test("includes Saturday records when the current date is in the same week", () => {
  const saturday = "2026-11-21";
  const weekDates = getAttendanceWeekDates("2026-11-22");

  assert.ok(weekDates.includes(saturday));
});
