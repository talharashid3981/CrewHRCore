import { z } from "zod";
import crypto from "node:crypto";
import userModel from "../models/User.js";
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../utils/emailService.js";
import {
  authCookieName,
  authCookieOptions,
  signAuthToken,
} from "../utils/sessionSecurity.js";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required").max(128),
  rememberMe: z.boolean().optional().default(true),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12, "Use at least 12 characters for your password").max(128),
  profilePic: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .trim()
      .url("Profile picture must be a valid URL")
      .max(2048)
      .optional(),
  ),
}).strict();

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .transform((value) => value.toLowerCase()),
});

const resetPasswordSchema = z.object({
  token: z.string().length(64, "Invalid reset token"),
  password: z.string().min(12, "Use at least 12 characters for your password").max(128),
});

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
});

export const registerController = async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message,
      });
    }

    const { name, email, password, profilePic } = parsed.data;
    const existingUser = await userModel.exists({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await userModel.create({
      name,
      email,
      password,
      profilePic,
      role: "employee",
    });

    res.cookie(authCookieName, signAuthToken(user), authCookieOptions());

    void sendWelcomeEmail(user).catch((error) =>
      console.error("Welcome email failed:", error.message),
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Registration failed:", error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const loginController = async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message,
      });
    }

    const { email, password, rememberMe } = parsed.data;

    const user = await userModel
      .findOne({ email: email.toLowerCase() })
      .select("+password +tokenVersion");
    if (!user || !user.isActive || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }
    res.cookie(authCookieName, signAuthToken(user), authCookieOptions(rememberMe));
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const forgotPasswordController = async (req, res) => {
  const genericResponse = {
    success: true,
    message:
      "If an account exists with this email, a password reset link has been sent",
  };

  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message,
      });
    }

    const user = await userModel.findOne({
      email: parsed.data.email,
      isActive: true,
    });

    if (!user) return res.status(200).json(genericResponse);

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const frontendUrl = (
      process.env.CLIENT_URL || "http://localhost:5173"
    ).replace(/\/$/, "");
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user, resetUrl);
    } catch (error) {
      user.resetPasswordTokenHash = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error("Password reset email failed:", error.message);
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password failed:", error.message);
    return res.status(200).json(genericResponse);
  }
};

export const resetPasswordController = async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0].message,
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(parsed.data.token)
      .digest("hex");
    const user = await userModel
      .findOne({
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpires: { $gt: new Date() },
        isActive: true,
      })
      .select("+resetPasswordTokenHash +resetPasswordExpires +tokenVersion");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or expired",
      });
    }

    user.password = parsed.data.password;
    user.tokenVersion += 1;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password reset successful. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getMeController = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: publicUser(req.user),
  });
};

export const logOutController = async (req, res) => {
  res.clearCookie(authCookieName, authCookieOptions(false));
  res.clearCookie("token", authCookieOptions(false));
  return res.status(200).json({ success: true, message: "Logout successful" });
};
