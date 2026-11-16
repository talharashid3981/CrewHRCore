import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { employeeMonthlyDetail, exportMonthly, monthlyReport } from "../controllers/reportController.js";

const router = express.Router();
router.use(protect, requireApproved);
router.get("/monthly", authorize("admin"), monthlyReport);
router.get("/monthly/export", authorize("admin"), exportMonthly);
router.get("/monthly/:employeeId", employeeMonthlyDetail);
export default router;
