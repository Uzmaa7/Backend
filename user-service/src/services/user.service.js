import { config } from "../config/index.js";
import logger from "../config/logger.js"
import { redis } from "../config/redis.js";
import AppError from "../utils/errors/appError.js";
import { StatusCodes } from "http-status-codes";

export class UserService{
    constructor(userRepository) {
        this.userRepository = userRepository
    }

    async getProfile(userId){
        //The Cache-Aside Pattern
        try {
            
            logger.info("First check user in redis");

            const storedUser = await redis.get(`user:${userId}`);

            if(storedUser){
                logger.info("User is stored in redis");
                return JSON.parse(storedUser);
            }

            logger.info("If user is not in redis , fetch user from DB");

            const userProfile = await this.userRepository.findById(userId);

            logger.info("Exclude password field from user");

            const {password: _password, ...safeUser} = userProfile;

            logger.info("Store user profile in redis for future lookups");

            await redis.set(`user:${userId}`, JSON.stringify(safeUser), "EX", config.REDIS_USER_TTL);

            return safeUser;

        } catch (error) {
            logger.error("Error inside UserService [getProfile]:", error);

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }
}