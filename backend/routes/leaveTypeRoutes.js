import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { createLeaveType, getLeavePolicySettings, listLeaveTypes, updateLeavePolicySettings, updateLeaveType } from "../controllers/leaveTypeController.js";

const router = express.Router();
router.use(protect);
router.get("/", requireApproved, listLeaveTypes);
router.get("/policy", requireApproved, getLeavePolicySettings);
router.use(authorize("admin"));
router.post("/", createLeaveType);
router.patch("/:id", updateLeaveType);
router.put("/policy", updateLeavePolicySettings);
export default router;
