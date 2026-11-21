import jwt from "jsonwebtoken";
import userModel from "../models/User.js";
import { authCookieName } from "../utils/sessionSecurity.js";


export const protect  = async (req,res,next)=>{
    try{
        const token = req.cookies?.[authCookieName];
        if(!token){
            return res.status(401).json({
                success : false ,
                message : "Token not found"
            })
        }

        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decode.id).select("+tokenVersion");
         if (!user || !user.isActive || decode.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = user

    return next();




    }
    catch(error){
        return res.status(401).json({
            success : false ,
            message : "Token is invalid"
        })
    }
}

export const authorize = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: "Forbidden",
        });
    }
    return next();
};

export const requireApproved = (req, res, next) => {
    if (req.user?.role === "admin") return next();
    if (req.user?.onboardingStatus !== "approved") {
        return res.status(403).json({
            success: false,
            message: "Your onboarding must be approved before using this feature",
            onboardingStatus: req.user?.onboardingStatus || "incomplete",
        });
    }
    return next();
};

