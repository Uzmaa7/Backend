import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";

/**
 * Middleware to extract user context from gateway headers
 * Gateway sets x-user-id after successful JWT verification
 */
export const getUserContext = (req, res, next) => {
    try {
       
        const userId = req.headers['x-user-id'];

        if (!userId) {
            // Agar bina gateway ke koi direct access kare toh block kar do
            throw new AppError(
                "User context missing - request must come through the API Gateway", 
                StatusCodes.UNAUTHORIZED
            );
        }

        
        req.user = { id: userId };
        
        next();
    } catch (error) {
        next(error);
    }
};