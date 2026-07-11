import { Kafka, logLevel } from 'kafkajs';
import logger from "./logger.js";
import { config } from "./index.js"

// console.log("KAFKA CONFIG CHECK:", config); 
const kafka = new Kafka({
     clientId: config.KAFKA_CLIENT_ID,
     brokers: [config.KAFKA_BROKER || 'localhost:9093'],
     logLevel: logLevel.ERROR,

     requestTimeout: 45000,          // 45 seconds explicitly fixed timeout
     connectionTimeout: 10000,       // 10 seconds basic connection threshold
     
     
     retry: {
          initialRetryTime: 300,
          retries: 10,
          maxRetryTime: 30000,
          multiplier: 2,
     },
});

const consumer = kafka.consumer({
     groupId: 'search-service-group',
     sessionTimeout: 30000,
     heartbeatInterval: 3000,
     maxPollIntervalMs: 300000,
     retry: { retries: 5 }
});





// Graceful shutdown
export const disconnectAll = async () => {
     logger.info('Shutting down Kafka connections...');
     try {
          await consumer.disconnect();
     } catch (error) {
          logger.error('Error disconnecting consumer:', error);
     }
     process.exit(0);
};

process.on('SIGTERM', disconnectAll);
process.on('SIGINT', disconnectAll);

export { kafka, consumer };