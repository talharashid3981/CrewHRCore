import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import {
  createCsrfToken,
  csrfCookieName,
  csrfCookieOptions,
} from "../utils/sessionSecurity.js";

const fifteenMinutes = 15 * 60 * 1000;

export const publicAuthLimiter = rateLimit({
  windowMs: fifteenMinutes,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again in 15 minutes." },
});

export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many invitation requests. Please try again later." },
});

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const safeEqual = (first, second) => {
  const firstBuffer = Buffer.from(first || "");
  const secondBuffer = Buffer.from(second || "");
  return firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual(firstBuffer, secondBuffer);
};

export const issueCsrfToken = (req, res) => {
  const token = createCsrfToken();
  res.cookie(csrfCookieName, token, csrfCookieOptions());
  return res.status(200).json({ success: true, csrfToken: token });
};

export const csrfProtection = (req, res, next) => {
  if (safeMethods.has(req.method) || req.path === "/api/auth/csrf" || req.path.endsWith("/daily-close")) {
    return next();
  }
  const cookieToken = req.cookies?.[csrfCookieName];
  const headerToken = req.get("x-csrf-token");
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ success: false, message: "Invalid CSRF token" });
  }
  return next();
};
