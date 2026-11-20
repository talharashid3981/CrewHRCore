import mongoose from "mongoose";
import crypto from "node:crypto";
import { z } from "zod";
import userModel from "../models/User.js";
import {
  sendEmployeeInviteEmail,
  sendOnboardingApprovedEmail,
  sendOnboardingRejectedEmail,
} from "../utils/emailService.js";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const shiftTimes = {
  AM: { shiftStart: "09:00", shiftEnd: "18:00" },
  PM: { shiftStart: "11:00", shiftEnd: "20:00" },
};

const profilePicSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().url("Profile picture must be a valid URL").max(2048).optional(),
);

const onboardingSchema = z.object({
  jobTitle: z.string().trim().min(1, "Job title is required").max(100),
  department: z.string().trim().min(1, "Department is required").max(100),
  shift: z.enum(["AM", "PM"]),
  joiningDate: z.coerce.date(),
}).strict();

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  profilePic: profilePicSchema,
}).strict();

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "At least 8 characters are required").max(128),
}).strict();

const adminUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  profilePic: profilePicSchema,
  department: z.string().trim().min(1).max(100).optional(),
  designation: z.string().trim().max(100).optional(),
  joiningDate: z.coerce.date().optional(),
  shift: z.enum(["AM", "PM"]).optional(),
  shiftStart: z.string().regex(timeRegex, "Invalid shift start time").optional(),
  shiftEnd: z.string().regex(timeRegex, "Invalid shift end time").optional(),
}).strict();

const statusSchema = z.object({ isActive: z.boolean() }).strict();
const inviteSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email format").transform((value) => value.toLowerCase()),
}).strict();
const idIsValid = (id) => mongoose.Types.ObjectId.isValid(id);

const minutes = (time) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

const validateShiftRange = (shiftStart, shiftEnd) => (
  shiftStart && shiftEnd && minutes(shiftStart) >= minutes(shiftEnd)
    ? "Shift end time must be later than shift start time"
    : null
);

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  profilePic: user.profilePic,
  email: user.email,
  role: user.role,
  department: user.department,
  designation: user.designation,
  joiningDate: user.joiningDate,
  shift: user.shift,
  shiftStart: user.shiftStart,
  shiftEnd: user.shiftEnd,
  isActive: user.isActive,
  onboardingStatus: user.onboardingStatus,
  rejectionNote: user.rejectionNote,
  onboardingSubmittedAt: user.onboardingSubmittedAt,
  approvedAt: user.approvedAt,
  approvedBy: user.approvedBy,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const validationError = (res, parsed) => res.status(400).json({
  success: false,
  message: parsed.error.issues[0]?.message || "Invalid request data",
});

const notFound = (res) => res.status(404).json({ success: false, message: "User not found" });

const sendEmailInBackground = (promise, label) => {
  void promise.catch((error) => console.error(`${label} failed:`, error.message));
};

const employeeFilterFromQuery = ({ status, account, department, search }) => {
  const filter = { role: "employee" };
  if (["incomplete", "pending", "approved", "rejected"].includes(status)) filter.onboardingStatus = status;
  if (account === "active") filter.isActive = true;
  if (account === "inactive") filter.isActive = false;
  if (department?.trim()) filter.department = department.trim();
  if (search?.trim()) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { email: { $regex: safeSearch, $options: "i" } },
      { department: { $regex: safeSearch, $options: "i" } },
      { designation: { $regex: safeSearch, $options: "i" } },
    ];
  }
  return filter;
};

const employeeSortFromQuery = (sort) => ({
  name: { name: 1, _id: 1 },
  joiningDate: { joiningDate: -1, _id: 1 },
  status: { onboardingStatus: 1, name: 1, _id: 1 },
}[sort] || { createdAt: -1, _id: -1 });

const csvCell = (value) => {
  const text = value === undefined || value === null ? "" : String(value);
  const safeText = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};

export const submitOnboarding = async (req, res) => {
  try {
    if (req.user.role !== "employee") {
      return res.status(403).json({ success: false, message: "Only employees can submit onboarding" });
    }
    if (!["incomplete", "rejected"].includes(req.user.onboardingStatus)) {
      return res.status(409).json({
        success: false,
        message: "Onboarding cannot be submitted in the current status",
        onboardingStatus: req.user.onboardingStatus,
      });
    }

    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);

    req.user.designation = parsed.data.jobTitle;
    req.user.department = parsed.data.department;
    req.user.shift = parsed.data.shift;
    req.user.joiningDate = parsed.data.joiningDate;
    req.user.onboardingStatus = "pending";
    req.user.rejectionNote = undefined;
    req.user.onboardingSubmittedAt = new Date();
    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Onboarding submitted. Waiting for admin approval.",
      user: publicUser(req.user),
    });
  } catch (error) {
    console.error("Submit onboarding failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    if (parsed.data.name !== undefined) req.user.name = parsed.data.name;
    if (parsed.data.profilePic !== undefined) req.user.profilePic = parsed.data.profilePic;
    await req.user.save();
    return res.status(200).json({ success: true, message: "Profile updated", user: publicUser(req.user) });
  } catch (error) {
    console.error("Update profile failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const changeMyPassword = async (req, res) => {
  try {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const user = await userModel.findById(req.user._id).select("+password");
    if (!user || !(await user.comparePassword(parsed.data.currentPassword))) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return res.status(400).json({ success: false, message: "New password must be different" });
    }
    user.password = parsed.data.newPassword;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    return res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getSummary = async (req, res) => {
  try {
    const [total, incomplete, pending, approved, rejected, active, inactive, departments] = await Promise.all([
      userModel.countDocuments({ role: "employee" }),
      userModel.countDocuments({ role: "employee", onboardingStatus: "incomplete" }),
      userModel.countDocuments({ role: "employee", onboardingStatus: "pending" }),
      userModel.countDocuments({ role: "employee", onboardingStatus: "approved" }),
      userModel.countDocuments({ role: "employee", onboardingStatus: "rejected" }),
      userModel.countDocuments({ role: "employee", isActive: true }),
      userModel.countDocuments({ role: "employee", isActive: false }),
      userModel.distinct("department", { role: "employee" }),
    ]);
    return res.status(200).json({
      success: true,
      summary: { total, incomplete, pending, approved, rejected, active, inactive },
      departments: departments.filter(Boolean).sort((left, right) => left.localeCompare(right)),
    });
  } catch (error) {
    console.error("Get user summary failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const listUsers = async (req, res) => {
  try {
    const { page = "1", limit = "8", sort } = req.query;
    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const filter = employeeFilterFromQuery(req.query);
    const [users, total] = await Promise.all([
      userModel.find(filter).sort(employeeSortFromQuery(sort)).skip((currentPage - 1) * pageSize).limit(pageSize),
      userModel.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      users: users.map(publicUser),
      pagination: { page: currentPage, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("List users failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const exportUsers = async (req, res) => {
  try {
    const users = await userModel.find(employeeFilterFromQuery(req.query))
      .sort(employeeSortFromQuery(req.query.sort))
      .select("name email department shiftStart shiftEnd designation joiningDate onboardingStatus isActive")
      .lean();
    const rows = [
      ["Name", "Email", "Department", "Shift", "Job title", "Joining date", "Onboarding", "Account"],
      ...users.map((employee) => [
        employee.name,
        employee.email,
        employee.department,
        employee.shiftStart && employee.shiftEnd
          ? `${employee.shiftStart}-${employee.shiftEnd}`
          : "",
        employee.designation,
        employee.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : "",
        employee.onboardingStatus,
        employee.isActive ? "Active" : "Inactive",
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="crewhr-employees.csv"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Export employees failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const inviteEmployee = async (req, res) => {
  try {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    if (await userModel.exists({ email: parsed.data.email })) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const user = await userModel.create({
      ...parsed.data,
      password: crypto.randomBytes(48).toString("hex"),
      role: "employee",
      resetPasswordTokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
      resetPasswordExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    try {
      await sendEmployeeInviteEmail(user, `${clientUrl}/reset-password?token=${rawToken}`);
    } catch (emailError) {
      user.resetPasswordTokenHash = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error("Employee invitation email failed:", emailError.message);
      return res.status(502).json({
        success: false,
        message: "Employee account was created, but the invitation email could not be sent. Use Send reminder to retry.",
        user: publicUser(user),
      });
    }

    return res.status(201).json({
      success: true,
      message: `Invitation sent to ${user.email}`,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Invite employee failed:", error);
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const remindEmployee = async (req, res) => {
  try {
    if (!idIsValid(req.params.id)) return notFound(res);
    const user = await userModel.findOne({ _id: req.params.id, role: "employee" })
      .select("+resetPasswordTokenHash +resetPasswordExpires");
    if (!user) return notFound(res);
    if (!["incomplete", "rejected"].includes(user.onboardingStatus)) {
      return res.status(409).json({ success: false, message: "Reminders are only available for incomplete or rejected onboarding" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    try {
      await sendEmployeeInviteEmail(user, `${clientUrl}/reset-password?token=${rawToken}`);
    } catch (emailError) {
      user.resetPasswordTokenHash = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error("Employee reminder email failed:", emailError.message);
      return res.status(502).json({ success: false, message: "The reminder email could not be sent. Please try again later." });
    }
    return res.status(200).json({ success: true, message: `Reminder sent to ${user.email}` });
  } catch (error) {
    console.error("Remind employee failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getUser = async (req, res) => {
  try {
    if (!idIsValid(req.params.id)) return notFound(res);
    const user = await userModel.findOne({ _id: req.params.id, role: "employee" });
    if (!user) return notFound(res);
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("Get user failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const applyAdminFields = (user, fields) => {
  const editableFields = ["name", "profilePic", "department", "designation", "joiningDate", "shift", "shiftStart", "shiftEnd"];
  for (const field of editableFields) {
    if (fields[field] !== undefined) user[field] = fields[field];
  }
  if (fields.shift && fields.shiftStart === undefined && fields.shiftEnd === undefined) Object.assign(user, shiftTimes[fields.shift]);
};

export const updateUser = async (req, res) => {
  try {
    if (!idIsValid(req.params.id)) return notFound(res);
    if (String(req.user._id) === req.params.id && req.body.role !== undefined) {
      return res.status(400).json({ success: false, message: "Admin cannot change their own role" });
    }
    const parsed = adminUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const rangeError = validateShiftRange(parsed.data.shiftStart, parsed.data.shiftEnd);
    if (rangeError) return res.status(400).json({ success: false, message: rangeError });
    const user = await userModel.findOne({ _id: req.params.id, role: "employee" });
    if (!user) return notFound(res);
    applyAdminFields(user, parsed.data);
    await user.save();
    return res.status(200).json({ success: true, message: "Employee updated", user: publicUser(user) });
  } catch (error) {
    console.error("Update user failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const approveUser = async (req, res) => {
  try {
    if (!idIsValid(req.params.id)) return notFound(res);
    const parsed = adminUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) return validationError(res, parsed);
    const rangeError = validateShiftRange(parsed.data.shiftStart, parsed.data.shiftEnd);
    if (rangeError) return res.status(400).json({ success: false, message: rangeError });
    const user = await userModel.findOne({ _id: req.params.id, role: "employee" });
    if (!user) return notFound(res);
    if (user.onboardingStatus !== "pending") {
      return res.status(409).json({ success: false, message: "Only pending employees can be approved" });
    }
    applyAdminFields(user, parsed.data);
    if (!user.shift) user.shift = "AM";
    if (!user.shiftStart || !user.shiftEnd) Object.assign(user, shiftTimes[user.shift]);
    const rangeAfterDefaults = validateShiftRange(user.shiftStart, user.shiftEnd);
    if (rangeAfterDefaults) return res.status(400).json({ success: false, message: rangeAfterDefaults });
    user.onboardingStatus = "approved";
    user.rejectionNote = undefined;
    user.approvedAt = new Date();
    user.approvedBy = req.user._id;
    await user.save();
    sendEmailInBackground(sendOnboardingApprovedEmail(user), "Approval email");
    return res.status(200).json({ success: true, message: "Employee approved", user: publicUser(user) });
  } catch (error) {
    console.error("Approve user failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const rejectUser = async (req, res) => {
  try {
    if (!idIsValid(req.params.id)) return notFound(res);
    const noteSchema = z.object({ note: z.string().trim().min(1, "Rejection note is required").max(1000) }).strict();
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const user = await userModel.findOne({ _id: req.params.id, role: "employee" });
    if (!user) return notFound(res);
    if (user.onboardingStatus !== "pending") {
      return res.status(409).json({ success: false, message: "Only pending employees can be rejected" });
    }
    user.onboardingStatus = "rejected";
    user.rejectionNote = parsed.data.note;
    user.approvedAt = undefined;
    user.approvedBy = undefined;
    await user.save();
    sendEmailInBackground(sendOnboardingRejectedEmail(user, parsed.data.note), "Rejection email");
    return res.status(200).json({ success: true, message: "Employee rejected", user: publicUser(user) });
  } catch (error) {
    console.error("Reject user failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const setUserStatus = async (req, res) => {
  try {
    if (!idIsValid(req.params.id)) return notFound(res);
    if (String(req.user._id) === req.params.id) {
      return res.status(400).json({ success: false, message: "Admin cannot deactivate themselves" });
    }
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed);
    const user = await userModel.findById(req.params.id);
    if (!user) return notFound(res);
    if (user.role === "admin") return res.status(400).json({ success: false, message: "Admin accounts cannot be changed here" });
    user.isActive = parsed.data.isActive;
    await user.save();
    return res.status(200).json({
      success: true,
      message: user.isActive ? "Employee activated" : "Employee deactivated",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Set user status failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
