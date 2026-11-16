import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { checkIn, checkOut, getAttendanceHistory, getTodayAttendance } from "../controllers/attendanceController.js";

const router = express.Router();

router.use(protect, requireApproved, authorize("employee"));
router.get("/today", getTodayAttendance);
router.get("/history", getAttendanceHistory);
router.post("/check-in", checkIn);
router.post("/check-out", checkOut);

export default router;
