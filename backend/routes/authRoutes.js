import express from "express"
import { forgotPasswordController, getMeController, loginController, logOutController, registerController, resetPasswordController } from "../controllers/authController.js"
import { protect } from "../middleware/auth.js"
import { issueCsrfToken, publicAuthLimiter } from "../middleware/security.js";

const router = express.Router()

router.get("/me", protect, getMeController)
router.get("/csrf", issueCsrfToken);
router.post("/register", publicAuthLimiter, registerController)
router.post("/login", publicAuthLimiter, loginController)
router.post("/forgot-password", publicAuthLimiter, forgotPasswordController)
router.post("/reset-password", publicAuthLimiter, resetPasswordController)
router.post("/logout", logOutController)


export default router
