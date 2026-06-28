import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import adminProducer from "../kafka/producer/admin.producer.js";
import logger from "../config/logger.js";

export class TrainService {
    constructor(trainRepository) {
        this.trainRepository = trainRepository
    }

    async createTrain(data) {

        try {
            const { trainNumber, trainName, coachName, seats } = data;

            const existingTrain = await this.trainRepository.findOne({ trainNumber });

            if (existingTrain) {
                throw new AppError("Train with this number already exists", StatusCodes.BAD_REQUEST);
            }

            // seats = [{seatNumber:1,seatType: AC, price:2000 }, {}, {}]
            const seatNumbers = seats.map((s) => s.seatNumber);

            if (new Set(seatNumbers).size !== seatNumbers.length) {
                throw new AppError('Duplicate seat number found', StatusCodes.BAD_REQUEST);
            }

            // seats: {
            //     create: [
            //         { seatNumber: 1, seatType: "LOWER", price: 2000 },
            //         { seatNumber: 2, seatType: "UPPER", price: 1800 }
            //     ]
            // }
            //seats: {create: []}
            const trainData = {
                trainNumber,
                trainName,
                coachName: coachName || 'AC',
                totalSeats: seats.length,
                seats: {
                    create: seats.map((seat) => ({
                        seatNumber: seat.seatNumber,
                        seatType: seat.seatType,
                        price: seat.price
                    }))
                }
            };

            const includeOptions = {
                seats: { orderBy: { seatNumber: 'asc' } }
            };

            const train = await this.trainRepository.createTrainWithSeats(trainData, includeOptions);

            await adminProducer.publishTrainCreated(train).catch((err) => {
                logger.error('Failed to publish train created event', { error: err.message });
            });

            return train;

        } catch (error) {
            logger.error("Error inside TrainService [createTrain]:", error);

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }
}