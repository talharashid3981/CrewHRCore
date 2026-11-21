import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export const authCookieName = process.env.NODE_ENV === "production"
  ? "__Host-crewhr-session"
  : "crewhr_session";
export const csrfCookieName = process.env.NODE_ENV === "production"
  ? "__Host-crewhr-csrf"
  : "crewhr_csrf";

export const authCookieOptions = (rememberMe = true) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  ...(rememberMe ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}),
  path: "/",
});

export const csrfCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
});

export const signAuthToken = (user) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ id: user._id.toString(), tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

export const createCsrfToken = () => crypto.randomBytes(32).toString("hex");
