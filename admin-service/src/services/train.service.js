import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import adminProducer from "../kafka/producer/admin.producer.js";
import logger from "../config/logger.js";
import prisma from "../config/prisma.js";

export class TrainService {
    constructor(trainRepository, routeRepository) {
        this.trainRepository = trainRepository
        this.routeRepository = routeRepository;
    }

    async createTrain(data) {

        try {
            const { trainNumber, trainName, coachName, seats } = data;

            const existingTrain = await this.trainRepository.findOne({ trainNumber });// 👈 { trainNumber: "12301" }

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


    async createRoute(data) {
        try {
            const { trainId, stations } = data;

            //train must exist
            const existTrain = await this.trainRepository.findById(trainId);

            if (!existTrain) {
                throw new AppError('Train not found', StatusCodes.NOT_FOUND);
            }

            //One train can only have single route
            const existingRoute = await this.routeRepository.findOne({ trainId });

            if (existingRoute) {
                throw new AppError("Route already exists for this train", StatusCodes.CONFLICT);
            }

            const stationIds = stations.map((station) => station.stationId);

            //all the stations of a route must exist
            const existingStations = await prisma.station.findMany({
                where: { id: { in: stationIds } }
            })


            if (existingStations.length !== stationIds.length) {
                throw new AppError('One or more station IDs are invalid', StatusCodes.BAD_REQUEST);
            }


            const sorted = [...stations].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

            for (let i = 0; i < sorted.length; i++) {
                if (sorted[i].sequenceNumber !== i + 1) {
                    throw new AppError('Sequence numbers must be continuous starting from 1', StatusCodes.BAD_REQUEST);
                }
            }

            const routeData = {
                trainId,
                routeStations: {
                    create: stations.map((s) => ({
                        stationId: s.stationId,
                        sequenceNumber: s.sequenceNumber,
                        arrivalTime: s.arrivalTime || null,
                        departureTime: s.departureTime || null,
                        distanceFromOrigin: s.distanceFromOrigin || 0,
                    }))
                }
            };

            const includeOptions = {
                routeStations: {
                    include: { station: true },
                    orderBy: { sequenceNumber: 'asc' },
                },
            };

            const route = await this.routeRepository.createRouteWithStations(routeData, includeOptions);
            // const route = await prisma.route.create({
            //     data: routeData,
            //     include:includeOptions
            // });

            const trainWithSeats = await prisma.train.findUnique({
                where: { id: trainId },
                include: { seats: { orderBy: { seatNumber: 'asc' } } },
            });

            await adminProducer.publishRouteCreated({ ...route, train: trainWithSeats }).catch((err) => {
                logger.error('Failed to publish route created event', { error: err.message });
            })

            return route;

        } catch (error) {
            logger.error("Error inside TrainService [createRoute]:", error);

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);

        }
    };

    async getTrainById(trainId) {
        try {

            const existTrain = await this.trainRepository.findTrainWithCompleteDetails(trainId);

            if (!existTrain) {
                throw new AppError("The requested train was not found", StatusCodes.NOT_FOUND);
            }

            return existTrain;

        } catch (error) {
            logger.error("Error inside TrainService [createRoute]:", error);

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);


        }
    }
}