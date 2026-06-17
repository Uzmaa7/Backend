import { StatusCodes } from "http-status-codes";
import {config} from "../config/index.js"
import logger from "../config/logger.js"
import AppError from "../utils/errors/appError.js";
import bcrypt from "bcrypt";
import {generateAndStoreOtp} from "../utils/otp.js";
import { sendOtpEmail } from "../utils/email.js";

export class AuthService{
    constructor(userRepository){
        this.userRepository = userRepository
    }

    async sendOtp(firstName, lastName, email, password) {

        try {
                const existingUser = await this.userRepository.findByEmail(email);
        
                if(existingUser){
                    throw new AppError("User already exists", StatusCodes.CONFLICT)
                }
        
                const hashedPassword = await bcrypt.hash(password, 12);
                const meta = { firstName, lastName, email, hashedPassword };
        
                const { otp, otpSessionId } = await generateAndStoreOtp(meta);
        
                await sendOtpEmail(email, otp);
                
                return { otpSessionId };

        } catch (error) {
            logger.error("Error inside AuthService [sendOtp]:", error);

            // Agar ye error humne khud 'throw new AppError' karke bheji hai (jaise user already exists), 
            // toh use jaisa ka taisa aage Controller ki taraf phek do.
            if(error instanceof AppError){
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }

    }
}
