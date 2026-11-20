import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { dailyCloseController, recomputeAttendanceController, resolveAttendanceRangeController, runAttendanceAutomationController } from "../controllers/automationController.js";
import { correctMissingCheckOut, exportAdminAttendanceDay, getAdminAttendanceDay } from "../controllers/adminAttendanceController.js";

const router = express.Router();
router.post("/daily-close", dailyCloseController);
router.post("/recompute", protect, authorize("admin"), recomputeAttendanceController);
router.post("/run-now", protect, requireApproved, authorize("admin"), runAttendanceAutomationController);
router.get("/resolve/:employeeId", protect, requireApproved, authorize("admin"), resolveAttendanceRangeController);
router.get("/day", protect, requireApproved, authorize("admin"), getAdminAttendanceDay);
router.get("/export", protect, requireApproved, authorize("admin"), exportAdminAttendanceDay);
router.post("/:attendanceId/correct-checkout", protect, requireApproved, authorize("admin"), correctMissingCheckOut);
export default router;
