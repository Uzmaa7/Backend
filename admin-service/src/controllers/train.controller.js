import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import { SuccessResponse, ErrorResponse } from "../utils/common/index.js";
import logger from "../config/logger.js";

export class TrainController {
    constructor(trainService) {
        if (!trainService) {
            throw new Error("TrainService is required for TrainService")
        }

        this.trainService = trainService;
    }

    async createTrain(req, res, next) {
        try {

            const { trainNumber, trainName, coachName, seats } = req.body;

            if (!trainNumber || !trainName || !coachName || !seats) {
                throw new AppError("All fields are required", StatusCodes.BAD_REQUEST);
            }

            if (seats.length === 0) {
                throw new AppError("Atleast one seat must be defined...", StatusCodes.BAD_REQUEST);
            }



            const train = await this.trainService.createTrain({ trainNumber, trainName, coachName, seats });

            SuccessResponse.data = train;
            SuccessResponse.message = "Train created Successfully";

            return res
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

    async createRoute(req, res, next) {
        try {

            const { trainId, stations } = req.body;

            if (!trainId || !stations) {
                throw new AppError("Train Id and stations are required", StatusCodes.BAD_REQUEST);
            }
    
            if (stations.length < 2) {
                throw new AppError("A route must have at least 2 stations (origin and destination)", StatusCodes.BAD_REQUEST);
            }
    
            const route = await this.trainService.createRoute({ trainId, stations });

            SuccessResponse.data = route;
            SuccessResponse.message = "Route created Successfully";
            
            return res
            .status(StatusCodes.CREATED)
            .json(SuccessResponse)

        } catch (error) {
            
            logger.error("Error in TrainController [createRoute] : ", error);

            ErrorResponse.error = error;
            const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

            return res
                .status(statusCode)
                .json(ErrorResponse)
        }
    }

    async getTrainById(req, res, next){
        try {
            
            const {trainId} = req.params;

            if(!trainId){
                throw new AppError("TrainID is missing", StatusCodes.BAD_REQUEST);
            }

            const train = await this.trainService.getTrainById(trainId);

            SuccessResponse.data = train;
            SuccessResponse.message = "Train fetched Successfully";

            return res
            .status(StatusCodes.OK)
            .json(SuccessResponse)

        } catch (error) {
            logger.error("Error in TrainController [getTrainById] : ", error);

            ErrorResponse.error = error;
            const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

            return res
                .status(statusCode)
                .json(ErrorResponse)
        }
    }
}