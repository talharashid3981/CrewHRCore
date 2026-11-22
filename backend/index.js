import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import connectDB from "./config/db.js";
import authrouter from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import leaveTypeRoutes from "./routes/leaveTypeRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import automationRoutes from "./routes/automationRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import cron from "node-cron";
import { csrfProtection } from "./middleware/security.js";
import {
  runAttendanceReminderEmails,
  runWeeklySummaryEmails,
} from "./services/emailNotificationService.js";


const app = express();
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV === "production";
const configuredOrigin = process.env.CLIENT_URL?.trim();
const allowedOrigins = new Set(configuredOrigin ? [configuredOrigin] : []);
if (!isProduction) {
  allowedOrigins.add(`${process.env.CLIENT_URL}`);
  allowedOrigins.add("http://127.0.0.1:5173");
}


app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  },
  credentials: true,
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(csrfProtection);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Crew HRCore API is Healthy" });
});

app.use("/api/auth", authrouter);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/jobs", automationRoutes);
app.use("/api/admin/attendance", automationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Invalid route" });
});

app.use((error, req, res, next) => {
  console.error("Unhandled request error:", error);
  if (res.headersSent) return next(error);
  res.status(500).json({success: false, message: "Internal server error" });
});



const PORT = process.env.PORT || 8000;

connectDB().then(async () => {
  try {
    const { closeDays } = await import("./services/automationService.js");
    await closeDays();
    cron.schedule("10 0 * * *", () => closeDays().catch((error) => console.error("Scheduled daily close failed:", error)), { timezone: "Asia/Karachi" });
  } catch (error) {
    console.error("Automation startup catch-up failed:", error);
  }
  cron.schedule("* * * * *", () => runAttendanceReminderEmails()
    .catch((error) => console.error("Attendance reminder job failed:", error)), { timezone: "Asia/Karachi" });
  cron.schedule("* * * * *", () => runWeeklySummaryEmails()
    .catch((error) => console.error("Weekly summary job failed:", error)), { timezone: "Asia/Karachi" });
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
