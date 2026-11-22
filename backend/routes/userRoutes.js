import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  submitOnboarding, updateMyProfile, changeMyPassword,
  uploadMyProfileImage,
  updateMyNotificationPreferences,
  getSummary, listUsers, exportUsers, inviteEmployee, remindEmployee, getUser, updateUser,
  repairEmployeeOnboardingStatus,
  approveUser, rejectUser, setUserStatus,
} from "../controllers/userController.js";
import { inviteLimiter, profileImageLimiter } from "../middleware/security.js";

const router = express.Router();
const parseProfileImage = express.raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: "5mb",
});

const parseProfileImageBody = (req, res, next) => {
  parseProfileImage(req, res, (error) => {
    if (error?.type === "entity.too.large") {
      return res.status(413).json({
        success: false,
        message: "Profile images must be 5 MB or smaller.",
      });
    }
    if (error) return next(error);
    return next();
  });
};

router.use(protect);

// Employee self-service routes must remain above the /:id routes.
router.post("/me/onboarding", submitOnboarding);
router.patch("/me", updateMyProfile);
router.patch("/me/notification-preferences", updateMyNotificationPreferences);
router.put(
  "/me/profile-image",
  profileImageLimiter,
  parseProfileImageBody,
  uploadMyProfileImage,
);
router.patch("/me/password", changeMyPassword);

// Admin only
router.use(authorize("admin"));
router.get("/summary", getSummary);
router.get("/export", exportUsers);
router.post("/invite", inviteLimiter, inviteEmployee);
router.get("/", listUsers);
router.post("/:id/repair-status", repairEmployeeOnboardingStatus);
router.post("/:id/remind", remindEmployee);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.patch("/:id/approve", approveUser);
router.patch("/:id/reject", rejectUser);
router.patch("/:id/status", setUserStatus);

export default router;
