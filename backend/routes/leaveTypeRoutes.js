import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import { createLeaveType, listLeaveTypes, updateLeaveType } from "../controllers/leaveTypeController.js";

const router = express.Router();
router.use(protect);
router.get("/", requireApproved, listLeaveTypes);
router.use(authorize("admin"));
router.post("/", createLeaveType);
router.patch("/:id", updateLeaveType);
export default router;
