import express from "express"
import { forgotPasswordController, getMeController, loginController, logOutController, registerController, resetPasswordController } from "../controllers/authController.js"
import { protect } from "../middleware/auth.js"

const router = express.Router()

router.get("/me", protect, getMeController)
router.post("/register", registerController)
router.post("/login", loginController)
router.post("/forgot-password", forgotPasswordController)
router.post("/reset-password", resetPasswordController)
router.post("/logout", logOutController)


export default router
