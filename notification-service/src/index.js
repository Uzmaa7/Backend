
import { StatusCodes } from 'http-status-codes';
import emailConsumer from './kafka/consumer/email.consumer.js';
import logger from './config/logger.js';
import AppError from './utils/errors/appError.js';

async function startNotificationService() {
     try {
          logger.info('Starting Notification Service...');

          const requiredEnvVars = ['SENDGRID_API_KEY', 'MAIL_SEND', 'KAFKA_BROKER'];
          const missing = requiredEnvVars.filter(varName => !process.env[varName]);

          if (missing.length > 0) {
               throw new AppError(
                    `Missing required environment variables: ${missing.join(', ')}`, 
                    StatusCodes.INTERNAL_SERVER_ERROR
               );
          }

          await emailConsumer.start();

          logger.info('✅ Notification Service started successfully');
          logger.info('Service is ready to process notifications');

     } catch (error) {
          logger.error('Failed to start Notification Service', {
               error: error.message,
               stack: error.stack
          });
          process.exit(1);
     }
}

process.on('unhandledRejection', (reason, promise) => {
     logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
     logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
     process.exit(1);
});

startNotificationService();