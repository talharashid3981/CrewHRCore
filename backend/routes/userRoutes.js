import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  submitOnboarding, updateMyProfile, changeMyPassword,
  getSummary, listUsers, exportUsers, inviteEmployee, remindEmployee, getUser, updateUser,
  approveUser, rejectUser, setUserStatus,
} from "../controllers/userController.js";
import { inviteLimiter } from "../middleware/security.js";

const router = express.Router();

router.use(protect);

// Employee self-service routes must remain above the /:id routes.
router.post("/me/onboarding", submitOnboarding);
router.patch("/me", updateMyProfile);
router.patch("/me/password", changeMyPassword);

// Admin only
router.use(authorize("admin"));
router.get("/summary", getSummary);
router.get("/export", exportUsers);
router.post("/invite", inviteLimiter, inviteEmployee);
router.get("/", listUsers);
router.post("/:id/remind", remindEmployee);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.patch("/:id/approve", approveUser);
router.patch("/:id/reject", rejectUser);
router.patch("/:id/status", setUserStatus);

export default router;
