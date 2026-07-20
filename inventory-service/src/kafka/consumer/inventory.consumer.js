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


     async cancelSchedule(req, res, next) {
        try {
            const { scheduleId } = req.params; 

            if (!scheduleId) {
                throw new AppError("Schedule ID is required in request parameters", StatusCodes.BAD_REQUEST);
            }

            const updatedSchedule = await this.scheduleService.cancelSchedule(scheduleId);

            SuccessResponse.data = updatedSchedule;
            SuccessResponse.message = "Schedule has been successfully cancelled";

            return res
                .status(StatusCodes.OK)
                .json(SuccessResponse);

        } catch (error) {
            logger.error("Error in ScheduleController [cancelSchedule] : ", error);


            const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
            ErrorResponse.error = error;

            return res
                .status(statusCode)
                .json(ErrorResponse);
        }
    }

}

export default new InventoryConsumer();