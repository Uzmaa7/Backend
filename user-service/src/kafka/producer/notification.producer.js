import { producer, connectProducer } from "../../config/kafka.js"
import logger from '../../config/logger.js';
import { StatusCodes } from "http-status-codes";
import AppError from "../../utils/errors/appError.js"
import { TOPICS } from "../../utils/constants.js";

//Singleton design patter
//connecting user-service to kafka server

class NotificationProducer {
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
    
            logger.error(`Error inside NotificationProducer [sendMessage] for topic: ${topic}`, error);

            
            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    async sendOtpEmail(email, otp, ttlMinutes = 5) {
        return this.sendMessage(
            TOPICS.OTP_EMAIL,
            `otp-${email}`,
            { email, otp, ttlMinutes }
        )
    }

    async sendWelcomeEmail(email, firstName){
          return this.sendMessage(
               TOPICS.WELCOME_EMAIL,
               `welcome-${email}`,
               {email, firstName}
          )
     }
}

export default new NotificationProducer();