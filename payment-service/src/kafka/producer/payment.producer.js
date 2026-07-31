import { producer, connectProducer } from "../../config/kafka.js"
import logger from '../../config/logger.js';
import { StatusCodes } from "http-status-codes";
import AppError from "../../utils/errors/appError.js"
import { TOPICS } from "../../utils/constants.js";

//Singleton design patter
//connecting payment-service to kafka server

class PaymentProducer {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            await connectProducer();
            this.isInitialized = true;
        }
    }

    async sendMessage(topic, key, value) {
        try {
            //1. connect with kafka
            await this.initialize();

            //2. create message
            const message = {
                topic,
                messages: [{
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    timeStamp: Date.now().toString()
                }]
            }

            //3. send msg to kafka(topic)
            const result = await producer.send(message);

            logger.info(`Message sent to kafka topic: ${topic}`, {
                key,
                partition: result[0].partition,
                offset: result[0].offset,
            });

            return result;

        } catch (error) {

            logger.error(`[Kafka Failure] Error inside PaymentProducer [sendMessage] for topic: ${topic}. Details: ${error.message}`, error);

            // Hum check kar sakte hain ki kya ye kafkajs ka connection/network error hai
            if (error.name === 'KafkaJSConnectionError' || error.message.includes('Connection timeout') || error.code === 'ECONNREFUSED') {
                throw new AppError(
                    "Event streaming service is temporarily unavailable. Process aborted to maintain data integrity.",
                    StatusCodes.INTERNAL_SERVER_ERROR
                );
            }

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    async publishPaymentSuccess(paymentOrderId, bookingId, gatewayPaymentId, amount) {
        return this.sendMessage(
            TOPICS.PAYMENT_SUCCESS,
            `payment-${paymentOrderId}`,
            {
                paymentOrderId,
                bookingId,
                gatewayPaymentId,
                amount,
                capturedAt: new Date().toISOString(),
            }
        );
    }

    async publishPaymentFailed(paymentOrderId, bookingId, reason) {
        return this.sendMessage(
            TOPICS.PAYMENT_FAILED,
            `payment-${paymentOrderId}`,
            {
                paymentOrderId,
                bookingId,
                reason,
                failedAt: new Date().toISOString(),
            }
        );
    }
}

export default new PaymentProducer();