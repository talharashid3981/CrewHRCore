import test from "node:test";
import assert from "node:assert/strict";
import {
  sendCheckInReminderEmail,
  sendWeeklySummaryEmail,
} from "../utils/emailService.js";

const withEmailConfig = async (run) => {
  const saved = {
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL,
    senderName: process.env.BREVO_SENDER_NAME,
    fetch: globalThis.fetch,
  };
  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.com";
  process.env.BREVO_SENDER_NAME = "Test HRMS";
  try {
    await run();
  } finally {
    if (saved.apiKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = saved.apiKey;
    if (saved.senderEmail === undefined) delete process.env.BREVO_SENDER_EMAIL;
    else process.env.BREVO_SENDER_EMAIL = saved.senderEmail;
    if (saved.senderName === undefined) delete process.env.BREVO_SENDER_NAME;
    else process.env.BREVO_SENDER_NAME = saved.senderName;
    globalThis.fetch = saved.fetch;
  }
};

test("attendance reminder sends through Brevo and escapes employee content", async () => {
  await withEmailConfig(async () => {
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return { ok: true, status: 201 };
    };

    await sendCheckInReminderEmail(
      { name: "<Employee>", email: "employee@example.com" },
      "2026-11-23",
      "09:15",
    );

    assert.equal(request.url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(request.body.to[0].email, "employee@example.com");
    assert.match(request.body.htmlContent, /&lt;Employee&gt;/);
    assert.match(request.body.htmlContent, /09:15/);
  });
});

test("weekly summary includes the computed attendance totals", async () => {
  await withEmailConfig(async () => {
    let body;
    globalThis.fetch = async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, status: 201 };
    };

    await sendWeeklySummaryEmail(
      { name: "Employee", email: "employee@example.com" },
      { from: "2026-11-16", to: "2026-11-22" },
      {
        daysAttended: 5,
        lateDays: 1,
        workedMinutes: 2400,
        leaveDays: 0,
        leaveRequestsSubmitted: 1,
        leaveRequestsApproved: 1,
        leaveRequestsRejected: 0,
      },
    );

    assert.match(body.subject, /2026-11-16 to 2026-11-22/);
    assert.match(body.htmlContent, /Days attended: <b>5<\/b>/);
    assert.match(body.htmlContent, /Recorded work hours: <b>40.0<\/b>/);
  });
});

test("Brevo delivery errors remain visible to the caller", async () => {
  await withEmailConfig(async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await assert.rejects(
      sendCheckInReminderEmail(
        { name: "Employee", email: "employee@example.com" },
        "2026-11-23",
        "09:15",
      ),
      /Brevo email failed \(401\): Unauthorized/,
    );
  });
});
