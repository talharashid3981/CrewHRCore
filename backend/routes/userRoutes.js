import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  submitOnboarding, updateMyProfile, changeMyPassword,
  getSummary, listUsers, getUser, updateUser,
  approveUser, rejectUser, setUserStatus,
} from "../controllers/userController.js";

const router = express.Router();

router.use(protect);

// Employee self-service routes must remain above the /:id routes.
router.post("/me/onboarding", submitOnboarding);
router.patch("/me", updateMyProfile);
router.patch("/me/password", changeMyPassword);

// Admin only
router.use(authorize("admin"));
router.get("/summary", getSummary);
router.get("/", listUsers);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.patch("/:id/approve", approveUser);
router.patch("/:id/reject", rejectUser);
router.patch("/:id/status", setUserStatus);

export default router;
