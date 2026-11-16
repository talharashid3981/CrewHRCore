import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { dailyCloseController, recomputeAttendanceController, resolveAttendanceRangeController } from "../controllers/automationController.js";

const router = express.Router();
router.post("/daily-close", dailyCloseController);
router.post("/recompute", protect, authorize("admin"), recomputeAttendanceController);
router.get("/resolve/:employeeId", protect, requireApproved, authorize("admin"), resolveAttendanceRangeController);
export default router;
