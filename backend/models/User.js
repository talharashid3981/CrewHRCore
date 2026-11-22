import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { defaultNotificationPreferences } from "../utils/notificationPreferences.js";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/; 
const notificationPreferencesSchema = new mongoose.Schema({
    leaveUpdates: { type: Boolean, default: defaultNotificationPreferences.leaveUpdates },
    attendanceReminders: {
        type: Boolean,
        default: defaultNotificationPreferences.attendanceReminders,
    },
    weeklySummary: { type: Boolean, default: defaultNotificationPreferences.weeklySummary },
}, { _id: false });


const userSchema = new mongoose.Schema({
    
    name : {
        type : String,
        required : true ,
        trim : true
    },
    profilePic : {
        type : String,
        trim : true,
        maxlength : 2048
    },
    profilePicPublicId: {
        type: String,
        select: false,
    },
    notificationPreferences: {
        type: notificationPreferencesSchema,
        default: () => ({}),
    },
    email : {
        type : String ,
        required : true ,
        trim : true,
        match: /^[\w.-]+@([\w-]+\.)+[\w-]{2,}$/,
        lowercase: true,
        unique: true,
    },
    password : {
        type : String,
        required  : true ,
        minlength : 8,
        select: false
    },
    role : {
        type : String ,
        enum : ["admin", "employee"],
        default : "employee",
    },
    department : {
        type : String,
        trim : true
    },
    designation : {
        type : String,
        trim : true
    },
    joiningDate : {
        type : Date
    },
    shift : {
        type : String ,
        enum : ["AM", "PM"],
        default : undefined
    } ,
    shiftStart : {
        type : String ,
        match : timeRegex 
    },
    shiftEnd :{
        type : String ,
        match : timeRegex 
    },
    isActive : {
        type : Boolean ,
        default : true
    },
    onboardingStatus : {
        type : String,
        enum : ["incomplete", "pending", "approved", "rejected"],
        default : "incomplete",
        index : true
    },
    rejectionNote : {
        type : String,
        trim : true,
        maxlength : 1000
    },
    onboardingSubmittedAt : {
        type : Date
    },
    approvedAt : {
        type : Date
    },
    approvedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    },
    resetPasswordTokenHash : {
        type : String,
        select : false
    },
    resetPasswordExpires : {
        type : Date,
        select : false
    },
    tokenVersion: {
        type: Number,
        default: 0,
        select: false
    }

},{
    timestamps : true
})


userSchema.pre("save", async function () {
    if(!this.isModified("password")) return 
    this.password = await bcrypt.hash(this.password,12)
})

userSchema.methods.comparePassword = function (plainPassword){
    return bcrypt.compare(plainPassword, this.password)
}

const userModel = mongoose.model("User", userSchema)

export default userModel
