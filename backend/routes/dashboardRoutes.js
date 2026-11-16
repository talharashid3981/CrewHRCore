import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { dashboardCalendar, dashboardMe, dashboardToday } from "../controllers/dashboardController.js";

const router = express.Router();
router.use(protect, requireApproved);
router.get("/today", authorize("admin"), dashboardToday);
router.get("/calendar", dashboardCalendar);
router.get("/me", authorize("employee"), dashboardMe);
export default router;
