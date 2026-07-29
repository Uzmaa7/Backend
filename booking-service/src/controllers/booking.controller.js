import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import { SuccessResponse, ErrorResponse } from "../utils/common/index.js";
import logger from "../config/logger.js";

export class BookingController {
    constructor(bookingService) {
        if (!bookingService) {
            throw new Error("bookingService is required for BookingController");
        }

        this.bookingService = bookingService;
    }

    async createBooking(req, res, next) {

        try {

            const userId = req.user.id;

            const { scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq } = req.body;

            if (!scheduleId || !seatIds || !passengers || !idempotencyKey) {
                throw new AppError('scheduleId, seatIds, passengers, and idempotencyKey are required', StatusCodes.BAD_REQUEST);
            }

            const result = await this.bookingService.createBooking(
                userId, scheduleId, seatIds, passengers, idempotencyKey,
                fromStationId, toStationId, fromSeq, toSeq
            );

            SuccessResponse.message = "Booking Created Successfully";
            SuccessResponse.data = result;

            return res
            .status(StatusCodes.CREATED)
            .json(SuccessResponse)



        } catch (error) {
            logger.error("Error in BookingController [createBooking]:", error);

            ErrorResponse.error = error;

            return res
                .status(error.statusCode)
                .json(ErrorResponse)
        }
    }


}