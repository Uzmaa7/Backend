import AppError from "../utils/errors/appError.js";
import { StatusCodes } from "http-status-codes";
import { SuccessResponse, ErrorResponse } from "../utils/common/index.js";
import logger from "../config/logger.js";

export class ScheduleController {
    constructor(scheduleService) {
        if (!scheduleService) {
            throw new Error("scheduleService is required for ScheduleController");
        }

        this.scheduleService = scheduleService;
    }

    async createSchedule(req, res, next) {
        try {

            const { trainId, departureDate } = req.body;

            if (!trainId || !departureDate) {
                throw new AppError("TrainId and DepartureDate is required", StatusCodes.BAD_REQUEST);
            }

            const schedule = await this.scheduleService.createSchedule({ trainId, departureDate });

            SuccessResponse.data = schedule;
            SuccessResponse.message = "Schedule is created";

            return res
                .status(StatusCodes.CREATED)
                .json(SuccessResponse)


        } catch (error) {
            logger.error("Error in ScheduleController [createSchedule] : ", error);

            ErrorResponse.error = error;

            return res
                .status(error.statusCode)
                .json(ErrorResponse)
        }
    }

    async cancelSchedule(req, res, next) {
        try {
            const { scheduleId } = req.params; 

            if (!scheduleId) {
                throw new AppError("Schedule ID is required in request parameters", StatusCodes.BAD_REQUEST);
            }

            const updatedSchedule = await this.scheduleService.cancelSchedule(scheduleId);

            SuccessResponse.data = updatedSchedule;
            SuccessResponse.message = "Schedule has been successfully cancelled";

            return res
                .status(StatusCodes.OK)
                .json(SuccessResponse);

        } catch (error) {
            logger.error("Error in ScheduleController [cancelSchedule] : ", error);


            const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
            ErrorResponse.error = error;

            return res
                .status(statusCode)
                .json(ErrorResponse);
        }
    }
}