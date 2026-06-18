import { StatusCodes } from "http-status-codes";
import { config } from "../config/index.js";
import AppError from "../utils/errors/appError.js";
import { ErrorResponse, SuccessResponse } from "../utils/common/index.js";
import logger from "../config/logger.js";


export class AuthController {
    constructor(authService) {
        if (!authService) {
            throw new Error("AuthService is required for AuthController");
        }

        this.authService = authService;


    }
    async sendOtp(req, res, next) {
        try {

            const {firstName, lastName, email, password, confirmPassword} = req.body;

            if(!firstName || !lastName || !email || !password || !confirmPassword){
                throw new AppError("All fields are mandatory to fill", StatusCodes.BAD_REQUEST)
            }

            if(password != confirmPassword){
                throw new AppError("Password and confirm Password mismatch", StatusCodes.BAD_REQUEST)
            }

            const {otpSessionId} = await this.authService.sendOtp(firstName, lastName, email, password);

            const cookieOptions = {
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: config.OTP_TTL * 1000
            }

            SuccessResponse.message = "OTP sent succesfuly"
            res
            .cookie("otp_session", otpSessionId, cookieOptions)
            .status(StatusCodes.OK)
            .json(SuccessResponse)

        } catch (error) {
            logger.error("Error in AuthController [sendOtp]:", error);
            
            ErrorResponse.error = error;

            return res
            .status(error.statusCode)
            .json(ErrorResponse)
           

        }
    }

    async verifyOtp(req, res, next){
        try {

            const {otp} = req.body;
            const otpSessionId = req.cookies?.otp_session;

            if(!otp || !otpSessionId){
                throw new AppError("Otp or otpSession is missing", StatusCodes.BAD_REQUEST);
            }

            const user = await this.authService.verifyOtp(otp, otpSessionId);

            SuccessResponse.data = user;
            SuccessResponse.message = "User create Successfully";

            return res
            .clearCookie("otp_session")
            .status(StatusCodes.CREATED)
            .json(SuccessResponse)

        } catch (error) {
            logger.error("Error in AuthController [verifyOtp]:", error);
            
            ErrorResponse.error = error;

            return res
            .status(error.statusCode)
            .json(ErrorResponse)
        }
    }
}   