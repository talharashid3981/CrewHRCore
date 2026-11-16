import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { applyLeave, approveLeave, cancelLeave, getEmployeeBalance, getMyBalance, getMyLeaves, listLeaves, previewLeave, rejectLeave } from "../controllers/leaveController.js";

const router = express.Router();
router.use(protect, requireApproved);
router.get("/preview", authorize("employee"), previewLeave);
router.get("/balance", authorize("employee"), getMyBalance);
router.get("/me", authorize("employee"), getMyLeaves);
router.post("/", authorize("employee"), applyLeave);
router.patch("/:id/cancel", authorize("employee"), cancelLeave);
router.get("/balance/:employeeId", authorize("admin"), getEmployeeBalance);
router.get("/", authorize("admin"), listLeaves);
router.patch("/:id/approve", authorize("admin"), approveLeave);
router.patch("/:id/reject", authorize("admin"), rejectLeave);
export default router;
