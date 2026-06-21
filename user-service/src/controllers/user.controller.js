import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import { SuccessResponse, ErrorResponse } from "../utils/common/index.js";
import logger from "../config/logger.js";


export class UserController{
    constructor(userService){
        if(!userService){
            throw new Error("userService is required for UserController");
        }

        this.userService = userService;
    }

    async getProfile(req, res, next){
        try {

            const userId = req.user.id;

            if(!userId){
                throw new AppError("User is missing", StatusCodes.BAD_REQUEST);
            }

            const user = await this.userService.getProfile(userId);

            SuccessResponse.message = "User profile fetched Successfully";
            SuccessResponse.data = user;

            res
            .status(StatusCodes.OK)
            .json(SuccessResponse)


        } catch (error) {
            logger.error("Error in UserController [getProfile]:", error);

            ErrorResponse.error = error;

            return res
                .status(error.statusCode)
                .json(ErrorResponse)
        }
    }
}