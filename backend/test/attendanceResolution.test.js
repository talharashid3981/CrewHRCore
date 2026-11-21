import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttendanceStartDate,
  isAttendanceDeadlinePassed,
} from "../services/automationService.js";

const employee = { shiftStart: "09:00", shiftEnd: "18:00" };
const momentAt = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return { dateKey: "2026-11-21", totalMinutes: hours * 60 + minutes };
};

test("past workdays are absent even without shift data", () => {
  assert.equal(isAttendanceDeadlinePassed({}, "2026-11-20", null, momentAt("10:00")), true);
});

test("today remains pending through the scheduled shift end", () => {
  assert.equal(isAttendanceDeadlinePassed(employee, "2026-11-21", null, momentAt("18:00")), false);
  assert.equal(isAttendanceDeadlinePassed(employee, "2026-11-21", null, momentAt("18:01")), true);
});

test("afternoon half-day leave ends the work window at the shift midpoint", () => {
  const leave = { duration: "half", halfDayPeriod: "afternoon" };
  assert.equal(isAttendanceDeadlinePassed(employee, "2026-11-21", leave, momentAt("13:29")), false);
  assert.equal(isAttendanceDeadlinePassed(employee, "2026-11-21", leave, momentAt("13:30")), true);
});

test("morning half-day leave keeps the work window open until shift end", () => {
  const leave = { duration: "half", halfDayPeriod: "morning" };
  assert.equal(isAttendanceDeadlinePassed(employee, "2026-11-21", leave, momentAt("13:30")), false);
  assert.equal(isAttendanceDeadlinePassed(employee, "2026-11-21", leave, momentAt("18:01")), true);
});

test("missing or invalid shifts do not mark today absent prematurely", () => {
  assert.equal(isAttendanceDeadlinePassed({}, "2026-11-21", null, momentAt("23:00")), false);
  assert.equal(isAttendanceDeadlinePassed({ shiftStart: "9", shiftEnd: "18:00" }, "2026-11-21", null, momentAt("23:00")), false);
});

test("attendance starts after approval and no earlier than the joining date", () => {
  const approvedAt = new Date("2026-11-21T06:00:00.000Z");
  assert.equal(
    getAttendanceStartDate({ approvedAt, joiningDate: new Date("2026-11-20T00:00:00.000Z") }),
    "2026-11-22",
  );
  assert.equal(
    getAttendanceStartDate({ approvedAt, joiningDate: new Date("2026-11-25T00:00:00.000Z") }),
    "2026-11-25",
  );
  assert.equal(getAttendanceStartDate({}), null);
});
