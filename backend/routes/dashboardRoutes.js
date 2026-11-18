import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { dashboardAdmin, dashboardCalendar, dashboardMe, dashboardToday } from "../controllers/dashboardController.js";

const router = express.Router();
router.use(protect, requireApproved);
router.get("/admin", authorize("admin"), dashboardAdmin);
router.get("/today", authorize("admin"), dashboardToday);
router.get("/calendar", dashboardCalendar);
router.get("/me", authorize("employee"), dashboardMe);
export default router;
