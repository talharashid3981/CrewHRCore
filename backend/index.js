import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authrouter from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";

const app = express();
app.disable("x-powered-by");

const isProduction = process.env.NODE_ENV === "production";
const configuredOrigin = process.env.CLIENT_URL?.trim();
const allowedOrigins = new Set(configuredOrigin ? [configuredOrigin] : []);
if (!isProduction) {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Crew HRCore API is Healthy" });
});

app.use("/api/auth", authrouter);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/attendance", attendanceRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Invalid route" });
});

app.use((error, req, res, next) => {
  console.error("Unhandled request error:", error);
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 8000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
