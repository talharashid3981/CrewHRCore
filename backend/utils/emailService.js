const brevoApiUrl = "https://api.brevo.com/v3/smtp/email";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const getEmailConfig = () => {
  const { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } = process.env;
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL || !BREVO_SENDER_NAME) {
    throw new Error("Brevo email configuration is incomplete");
  }
  return { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME };
};

const sendEmail = async ({ to, subject, htmlContent }) => {
  const { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } = getEmailConfig();
  const response = await fetch(brevoApiUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Brevo email failed (${response.status}): ${details}`);
  }
};

export const sendWelcomeEmail = (user) => sendEmail({
  to: user.email,
  subject: "Welcome to Crew HRCore",
  htmlContent: `
    <h2>Welcome, ${escapeHtml(user.name)}!</h2>
    <p>Your Crew HRCore account has been created successfully.</p>
    <p>You can now manage your attendance and leave requests from your dashboard.</p>
  `,
});

export const sendEmployeeInviteEmail = (user, setupUrl) => sendEmail({
  to: user.email,
  subject: "You’re invited to Crew HRCore",
  htmlContent: `
    <h2>Welcome, ${escapeHtml(user.name)}!</h2>
    <p>An administrator invited you to join Crew HRCore.</p>
    <p>Use the secure link below to set your password and complete your employee profile. This link expires in 24 hours.</p>
    <p><a href="${escapeHtml(setupUrl)}">Set up your account</a></p>
    <p>If you were not expecting this invitation, you can ignore this email.</p>
  `,
});

export const sendPasswordResetEmail = (user, resetUrl) => sendEmail({
  to: user.email,
  subject: "Reset your Crew HRCore password",
  htmlContent: `
    <h2>Password reset request</h2>
    <p>Hello ${escapeHtml(user.name)},</p>
    <p>Click the link below to set a new password. This link expires in 15 minutes.</p>
    <p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `,
});


export const sendOnboardingApprovedEmail = (user) => sendEmail({
  to: user.email,
  subject: "Your Crew HRCore profile is approved",
  htmlContent: `
    <h2>Hello ${escapeHtml(user.name)},</h2>
    <p>Your profile has been approved.</p>
    <p>Your shift: <b>${escapeHtml(user.shiftStart)} - ${escapeHtml(user.shiftEnd)}</b></p>
    <p>You can now check in and apply for leave.</p>
  `,
});

export const sendOnboardingRejectedEmail = (user, note) => sendEmail({
  to: user.email,
  subject: "Action needed: update your Crew HRCore profile",
  htmlContent: `
    <h2>Hello ${escapeHtml(user.name)},</h2>
    <p>Your admin asked you to update your details:</p>
    <p><i>${escapeHtml(note)}</i></p>
    <p>Please log in, correct them and submit again.</p>
  `,
});

export const sendLeaveApprovedEmail = (user, leave) => sendEmail({
  to: user.email,
  subject: "Your Crew HRCore leave was approved",
  htmlContent: `
    <h2>Hello ${escapeHtml(user.name)},</h2>
    <p>Your <b>${escapeHtml(leave.leaveType?.name || "leave")}</b> request has been approved.</p>
    <p>${escapeHtml(leave.from)} to ${escapeHtml(leave.to)} (${escapeHtml(leave.days)} working days)</p>
  `,
});

export const sendLeaveRejectedEmail = (user, leave, note) => sendEmail({
  to: user.email,
  subject: "Your Crew HRCore leave was rejected",
  htmlContent: `
    <h2>Hello ${escapeHtml(user.name)},</h2>
    <p>Your leave request for ${escapeHtml(leave.from)} to ${escapeHtml(leave.to)} was rejected.</p>
    <p><b>Admin note:</b> ${escapeHtml(note)}</p>
  `,
});
