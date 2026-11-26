import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAttendanceMessage,
  shareWhatsAppMessage,
} from "./whatsappAttendance.js";

const employee = {
  name: "Ahmad Ali",
  employeeId: "EMP001",
  designation: "MERN Stack Developer",
  department: "Software Development",
};
const attendance = {
  date: "2026-11-21",
  checkIn: "2026-11-21T04:15:00.000Z",
  checkOut: "2026-11-21T13:15:00.000Z",
  workedMinutes: 540,
  status: "present",
};

test("formats check-in details from the saved attendance record", () => {
  const message = formatAttendanceMessage("in", employee, attendance);

  assert.match(message, /Date: 21 Nov 2026 \(Saturday\)/);
  assert.match(message, /Name: Ahmad Ali/);
  assert.match(message, /Employee ID: EMP001/);
  assert.match(message, /Position: MERN Stack Developer/);
  assert.match(message, /Department: Software Development/);
  assert.match(message, /Entry Time: 09:15 AM/);
  assert.match(message, /Status: Present/);
  assert.doesNotMatch(message, /Exit Time|Working Hours/);
});

test("formats check-out time, saved working minutes, and late status", () => {
  const message = formatAttendanceMessage("out", employee, {
    ...attendance,
    status: "late",
  });

  assert.match(message, /Entry Time: 09:15 AM/);
  assert.match(message, /Exit Time: 06:15 PM/);
  assert.match(message, /Working Hours: 9 Hours/);
  assert.match(message, /Status: Checked Out \(Late\)/);
});

test("requires a saved check-out before formatting its report", () => {
  assert.throws(
    () => formatAttendanceMessage("out", employee, { ...attendance, checkOut: null }),
    /saved check-out time is unavailable/,
  );
});

test("uses WhatsApp Web with a URL-encoded message when Web Share is unavailable", async (context) => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  let openedUrl = "";

  context.after(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      open(url) {
        openedUrl = url;
        return { opener: null };
      },
    },
  });

  assert.equal(await shareWhatsAppMessage("Attendance\nReport"), "whatsapp");
  assert.equal(
    openedUrl,
    "https://web.whatsapp.com/send?text=Attendance%0AReport",
  );
});

test("navigates to WhatsApp's mobile chat link in the current tab", async (context) => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  let navigatedUrl = "";
  let openedUrl = "";

  context.after(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        assign(url) {
          navigatedUrl = url;
        },
      },
      open(url) {
        openedUrl = url;
        return { opener: null };
      },
    },
  });

  assert.equal(await shareWhatsAppMessage("Attendance\nReport"), "whatsapp");
  assert.equal(navigatedUrl, "https://wa.me/?text=Attendance%0AReport");
  assert.equal(openedUrl, "");
});

test("treats native share cancellation as a cancellation, not a failure", async (context) => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  let openedUrl = "";

  context.after(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      share: async () => {
        const error = new Error("Share cancelled");
        error.name = "AbortError";
        throw error;
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false }),
      open(url) {
        openedUrl = url;
        return null;
      },
    },
  });

  assert.equal(await shareWhatsAppMessage("Attendance report"), "cancelled");
  assert.equal(openedUrl, "");
});
