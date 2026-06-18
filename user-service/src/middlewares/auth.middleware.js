import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError";
import prisma from "../config/prisma.js";
import logger from "../config/logger.js";
import { config } from "../config/index.js";
import jwt from "jsonwebtoken";


export const verifyJWT = async(req, res, next) => {

    try {
        const token = req.cookies?.accessToken || req.header
        ("Authorization")?.replace("Bearer ", "")

        if(!token){
            throw new AppError("Unauthorized request", StatusCodes.UNAUTHORIZED);
        }

        // lets verify the token 
        const decodedToken = jwt.verify(token, config.ACCESS_TOKEN_SECRET);

        const user = await prisma.user.findUnique({
            where: {
                id: decodedToken.id
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true
               
            }
        });

        if(!user){
            throw new AppError("Invalid Access Token",StatusCodes.UNAUTHORIZED);
        }

        req.user = {
            id: decodedToken.id
        }

        next()

    } catch (error) {
        logger.error("Error inside AuthMiddleware [verifyJWT]:", error);

        if (error instanceof AppError) {
            return next(error); 
        }

        // B: Agar error JsonWebToken ki wajah se aayi hai (Jaise: expired token ya tampered token)
        if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
            return next(new AppError("Your session has expired or the token is invalid. Please login again.", StatusCodes.UNAUTHORIZED));
        }

        return next(new AppError("Something went wrong while verifying your identity", StatusCodes.INTERNAL_SERVER_ERROR));
    }
}