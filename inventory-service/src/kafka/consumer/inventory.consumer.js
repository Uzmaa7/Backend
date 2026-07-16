import {consumer,connectProducer, producer} from "../../config/kafka.js";
import { TOPICS } from "../../utils/constant.js";
import { StatusCodes } from 'http-status-codes';
import AppError from '../../utils/errors/appError.js';
import logger from "../../config/logger.js";
import {withDLQ} from "../../utils/dlqHandler.js";
import inventoryService from "../../services/inventory.service.js";


class InventoryConsumer {
     async start() {
          await consumer.connect();
          await connectProducer(); // needed for DLQ publishing
          logger.info('Inventory consumer connected');

          await consumer.subscribe({
               topics: [
                    TOPICS.SCHEDULE_CREATED,
                    TOPICS.SCHEDULE_CANCELLED,
               ],
               fromBeginning: true,
          });

          await consumer.run({
               eachMessage: withDLQ(producer, TOPICS.DLQ_INVENTORY, logger, async ({ topic, partition, message, parsedValue }) => {
                    logger.info(`Processing ${topic}`, {
                         partition,
                         offset: message.offset,
                    });

                    switch (topic) {
                         case TOPICS.SCHEDULE_CREATED:
                              await inventoryService.initializeInventory(parsedValue);
                              break;

                         case TOPICS.SCHEDULE_CANCELLED:
                              await inventoryService.cancelScheduleInventory(parsedValue);
                              break;

                         default:
                              logger.warn(`Unhandled topic: ${topic}`);
                    }
               }),
          });

          logger.info('Inventory consumer running...');
     }
}

export default new InventoryConsumer();