import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/; 


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
        trim : true,
        default : "General"
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
