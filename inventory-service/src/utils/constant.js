const TOPICS = {
  SCHEDULE_CREATED: 'admin.schedule-created',
  SCHEDULE_CANCELLED: 'admin.schedule-cancelled',
  DLQ_INVENTORY: 'dlq.inventory-service',
  SEAT_AVAILABILITY_UPDATED: 'inventory.seat-availability-updated',
 
};

/**
 * Max retries before a consumer message is sent to the DLQ.
 * After this many failures the message is considered poison.
 */
const DLQ_MAX_RETRIES = 3;


export {TOPICS, DLQ_MAX_RETRIES}