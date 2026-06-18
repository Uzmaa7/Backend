import { StatusCodes } from "http-status-codes";
import {config} from "../config/index.js"
import logger from "../config/logger.js"
import AppError from "../utils/errors/appError.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {generateAndStoreOtp, verifyOtp} from "../utils/otp.js";
import { sendOtpEmail,  verifyOtpEmail} from "../utils/email.js";
import { generateAccessAndRefreshToken } from "../utils/auth.js";
import {redis} from "../config/redis.js";

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

    async verifyOtp(otp, otpSessionId){
        try {

            const meta = await verifyOtp(otp, otpSessionId);
            if(meta === null){
                throw new AppError("Invalid or expired OTP", StatusCodes.BAD_REQUEST);
            }

            //user create
            const user = await this.userRepository.create({
                firstName: meta.firstName,
                lastName: meta.lastName,
                email:meta.email,
                password:meta.hashedPassword,
                emailVerified: true,
            })

            await verifyOtpEmail(meta);

            return user;


        } catch (error) {
            logger.error("Error inside AuthService [verifyOtp]:", error);

            if(error instanceof AppError){
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    async login(email, password){

        try {
            const existingUser = await this.userRepository.findByEmail(email);
    
            if(!existingUser){
                throw new AppError("User not found", StatusCodes.BAD_REQUEST);
            }
    
            const isPasswordMatch = await bcrypt.compare(password, existingUser.password);
    
            if(!isPasswordMatch){
                throw new AppError("Invalid credentials", StatusCodes.BAD_REQUEST);
            }
    
            const {accessToken, refreshToken} = await generateAccessAndRefreshToken(existingUser.id);
    
            const {jti} = jwt.decode(refreshToken);

            //store refresh token -> jti in redis
            await redis.set(`refresh:${existingUser.id}`, jti, "EX", config.REFRESH_TOKEN_EXP_SEC);
    
            const {password: _password, ...safeUser} = existingUser;

            //store user in redis 
            await redis.set(`user:${existingUser.id}`, JSON.stringify(safeUser), "EX", config.REDIS_USER_TTL)
    
    
            return {accessToken, refreshToken, loggedInUser: safeUser};

        } catch (error) {
            
               logger.error("Error inside AuthService [login]:", error);

            if(error instanceof AppError){
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }
}
