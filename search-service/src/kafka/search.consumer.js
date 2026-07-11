import { consumer } from "../config/kafka.js";
import { StatusCodes } from 'http-status-codes';
import AppError from '../utils/errors/appError.js';
import logger from "../config/logger.js";
import { TOPICS } from '../utils/constant.js';
import searchService from "../services/search.service.js";

class SearchConsumer {
    async start() {
        try {
            await consumer.connect();
            logger.info('Search consumer connected to Kafka');

            await consumer.subscribe({
                topics: [
                    TOPICS.STATION_CREATED,
                    TOPICS.ROUTE_CREATED,
                    TOPICS.SCHEDULE_CREATED,

                ],
                fromBeginning: true
            });

            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const value = JSON.parse(message.value.toString());
                        logger.info(`Processing message from topic: ${topic}`, {
                            partition,
                            offset: message.offset,
                            key: message.key?.toString(),
                        });

                        switch (topic) {
                            case TOPICS.STATION_CREATED:
                                await searchService.indexStation(value);
                                break;
                            case TOPICS.ROUTE_CREATED:
                                await searchService.indexTrainRoute(value);
                                break;
                            case TOPICS.SCHEDULE_CREATED:
                              await searchService.indexSchedule(value);
                              break;
                            default:
                                logger.warn(`Unknown topic: ${topic}`);
                        }

                    } catch (error) {
                        logger.error('Error processing message', {
                            topic,
                            partition,
                            offset: message.offset,
                            error: error.message,
                            stack: error.stack,
                        });

                        // TODO: Send to dead letter queue for failed messages
                        // await this.sendToDeadLetterQueue(topic, message, error);
                    }
                },
            });

            logger.info('Search consumer is running and listening for messages...');
        } catch (error) {
            logger.error('Error inside SearchConsumer [start]:', error);

            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError("Failed to initialize background message consumer", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }


    async stop() {
        await consumer.disconnect();
        logger.info('Search consumer disconnected');
    }
}

export default new SearchConsumer();