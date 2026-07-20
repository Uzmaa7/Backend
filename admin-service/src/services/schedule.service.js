import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import adminProducer from "../kafka/producer/admin.producer.js";
import logger from "../config/logger.js";
import prisma from "../config/prisma.js";

export class ScheduleService {
    constructor(scheduleRepository, trainRepository) {
        this.scheduleRepository = scheduleRepository
        this.trainRepository = trainRepository
    }

    async createSchedule(data) {
        try {

            const { trainId, departureDate } = data;

            const existTrain = await this.trainRepository.findTrainWithCompleteDetails(trainId);

            if (!existTrain) {
                throw new AppError('Train not found', StatusCodes.NOT_FOUND);
            }

            if (existTrain.seats.length === 0) {
                throw new AppError('Train has no seats defined', StatusCodes.BAD_REQUEST);
            }

            if (!existTrain.route) {
                throw new AppError("This trains has no defined route. Create a route first", StatusCodes.BAD_REQUEST);
            }

            const parseDate = new Date(departureDate);

            if (isNaN(parseDate.getTime())) {
                throw new AppError("Invalid departure Date format. Use YYYY-MM-DD", StatusCodes.BAD_REQUEST);
            }

            const existSchedule = await this.scheduleRepository.findExistingSchedule(trainId, parseDate);

            if (existSchedule) {
                throw new AppError("A schedule already exists for this train on the specified date", StatusCodes.CONFLICT);
            }



            const schedule = await this.scheduleRepository.create({
                trainId: trainId,
                departureDate: parseDate
            })



            // Build a rich event payload with everything consumers need
            const eventPayload = {
                scheduleId: schedule.id,
                trainId: existTrain.id,
                trainNumber: existTrain.trainNumber,
                trainName: existTrain.trainName,
                coachName: existTrain.coachName,
                totalSeats: existTrain.totalSeats,
                departureDate: departureDate,
                status: schedule.status,
                seats: existTrain.seats.map((s) => ({
                    seatId: s.id,
                    seatNumber: s.seatNumber,
                    seatType: s.seatType,
                    price: s.price,
                })),
                route: existTrain.route.routeStations.map((rs) => ({
                    stationId: rs.station.id,
                    stationName: rs.station.name,
                    stationCode: rs.station.code,
                    city: rs.station.city,
                    sequenceNumber: rs.sequenceNumber,
                    arrivalTime: rs.arrivalTime,
                    departureTime: rs.departureTime,
                    distanceFromOrigin: rs.distanceFromOrigin,
                })),
            };

            // This event goes to both inventory-service and search-service via Kafka
            await adminProducer.publishScheduleCreated(eventPayload).catch((err) => {
                logger.info('Failed to publish schedule created event', { error: err.message });
            })

            logger.info(`Schedule created and event published for train ${existTrain.trainNumber} on ${departureDate}`);

            return schedule;

        } catch (error) {
            logger.error("Error inside ScheduleService [createSchedule]:", error);

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    async cancelSchedule(scheduleId) {
        const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
        if (!schedule) throw new AppError('Schedule not found', StatusCodes.NOT_FOUND);
        const updated = await prisma.schedule.update({
            where: { id: scheduleId },
            data: { status: 'CANCELLED' },
        });

        await adminProducer.publishScheduleCancelled(updated);
        logger.info(`Schedule ${scheduleId} successfully cancelled and event published`);
        return updated;
    };
}