import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import { SuccessResponse, ErrorResponse } from "../utils/common/index.js";
import logger from "../config/logger.js";

export class TrainController{
    constructor(trainService){
        if(!trainService){
            throw new Error("TrainService is required for TrainService")
        }

        this.trainService = trainService;
    }

    async createTrain(req, res, next){
        try {

            const {trainNumber, trainName, coachName, seats} = req.body;

            if(!trainNumber || !trainName || !coachName || !seats){
                throw new AppError("All fields are required", StatusCodes.BAD_REQUEST);
            }

            if(seats.length === 0){
                throw new AppError("Atleast one seat must be defined...", StatusCodes.BAD_REQUEST);
            }



            const train = await this.trainService.createTrain({trainNumber, trainName, coachName, seats});

            SuccessResponse.data = train;
            SuccessResponse.message = "Train created Successfully";

            res
            .status(StatusCodes.CREATED)
            .json(SuccessResponse)


        } catch (error) {
            logger.error("Error in TrainController [createTrain] : ", error);
            
            ErrorResponse.error = error;
            const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

            return res
                .status(statusCode)
                .json(ErrorResponse)
        }
    }
}