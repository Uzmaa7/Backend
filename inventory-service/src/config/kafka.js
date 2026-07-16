import { Kafka, logLevel } from 'kafkajs';
import logger from "./logger.js";
import { config } from "./index.js"


const kafka = new Kafka({
     clientId: config.KAFKA_CLIENT_ID,
     brokers: [config.KAFKA_BROKER || 'localhost:9093'],
     logLevel: logLevel.ERROR,
     retry: {
          initialRetryTime: 300,
          retries: 8,
          maxRetryTime: 30000,
     },
});

const producer = kafka.producer({
     allowAutoTopicCreation: true,
     transactionTimeout: 30000,
     idempotent: true, 
     maxInFlightRequests: 5,
     retry: {
          retries: 5,
     },
});

let isConnected = false;

const connectProducer = async () => {
     if (!isConnected) {
          await producer.connect();
          isConnected = true;
          logger.info('Kafka producer connected');
     }
};

const disconnectProducer = async () => {
     if (isConnected) {
          await producer.disconnect();
          isConnected = false;
          logger.info('Kafka producer disconnected');
     }
};


// Consumer (for SCHEDULE_CREATED, SCHEDULE_CANCELLED)
const consumer = kafka.consumer({
     groupId: 'inventory-service-group',
     sessionTimeout: 30000,
     heartbeatInterval: 3000,
     maxPollIntervalMs: 300000,
     retry: { retries: 5 }
});

let isConsumerConnected = false;

const connectConsumer = async () => {
     if (!isConsumerConnected) {
          await consumer.connect();
          isConsumerConnected = true;
          logger.info('Kafka consumer connected successfully.');
     }
};



const disconnectConsumer =  async () => {
     if (isConsumerConnected) {
          await consumer.disconnect();
          isConsumerConnected = false;
          logger.info('Kafka consumer disconnected.');
     }
};


const disconnectAll = async () => {
     await disconnectProducer();
     await disconnectConsumer();
};

export { kafka, producer, consumer, connectProducer,connectConsumer,
     disconnectProducer, disconnectConsumer, disconnectAll };