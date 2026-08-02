import { consumer } from "../config/kafka.js";
import { producer, connectProducer } from "../../config/kafka.js";
import { StatusCodes } from 'http-status-codes';
import AppError from '../utils/errors/appError.js';
import logger from "../config/logger.js";
import { TOPICS } from '../utils/constant.js';
import bookingService from "../../services/booking.service.js";
import {withDLQ} from '../../../../inventory-service/src/utils/dlqHandler.js';

class BookingConsumer {
    async start() {

        await consumer.connect();
        await connectProducer(); // needed for DLQ publishing
        logger.info('Booking consumer connected');

        await consumer.subscribe({
            topics: [
                TOPICS.PAYMENT_SUCCESS,
                TOPICS.PAYMENT_FAILED,
                TOPICS.SCHEDULE_CANCELLED,

            ],
            fromBeginning: true
        });

        await consumer.run({


            eachMessage: withDLQ(producer, TOPICS.DLQ_BOOKING, logger, async ({ topic, partition, message, parsedValue }) => {
                logger.info(`Received message on topic: ${topic}`, {
                    partition,
                    offset: message.offset,
                    key: message.key?.toString(),
                });

                switch (topic) {
                    case TOPICS.PAYMENT_SUCCESS:
                        await bookingService.handlePaymentSuccess(
                            parsedValue.paymentOrderId,
                            parsedValue.gatewayPaymentId,
                            parsedValue.amount
                        );
                        break;

                    case TOPICS.PAYMENT_FAILED:
                        await bookingService.handlePaymentFailure(
                            parsedValue.paymentOrderId,
                            parsedValue.reason
                        );
                        break;

                    case TOPICS.SCHEDULE_CANCELLED: {
                        const scheduleId = parsedValue.scheduleId || parsedValue.id || (parsedValue.data && parsedValue.data.scheduleId);
                        await bookingService.handleScheduleCancelled(scheduleId);
                        break;
                    }

                    default:
                        logger.warn(`Unknown topic: ${topic}`);
                }




            }),
        })

        logger.info('Booking consumer running');
    }

    async stop() {
        await consumer.disconnect();
        logger.info('Booking consumer disconnected');
    }
}



export default new BookingConsumer();