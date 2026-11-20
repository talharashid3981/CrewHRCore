import express from "express";
import { authorize, protect, requireApproved } from "../middleware/auth.js";
import {
  createHoliday,
  deleteHoliday,
  getOfficeSettings,
  getOnboardingShiftTimes,
  listHolidays,
  updateHoliday,
  updateOfficeSettings,
} from "../controllers/settingsController.js";

const router = express.Router();

router.use(protect);

router.get("/onboarding-shifts", getOnboardingShiftTimes);
// Employees can read general settings and upcoming holidays, but never coordinates.
router.get("/office", requireApproved, getOfficeSettings);
router.get("/holidays", requireApproved, listHolidays);

router.use(authorize("admin"));
router.put("/office", updateOfficeSettings);
router.post("/holidays", createHoliday);
router.patch("/holidays/:id", updateHoliday);
router.delete("/holidays/:id", deleteHoliday);

export default router;
