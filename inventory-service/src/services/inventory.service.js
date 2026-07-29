import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { config } from '../config/index.js';
import inventoryProducer from '../kafka/producer/inventory.producer.js';
import AppError from '../../../booking-service/src/utils/errors/appError.js';
import { StatusCodes } from "http-status-codes";

// ─── Kafka Event Handlers ───────────────────────────────────────────────────

const initializeInventory = async (eventData) => {
     const { scheduleId, trainId, trainNumber, trainName, departureDate, seats } = eventData;

     if (!scheduleId || !seats || !seats.length) {
          logger.warn('Invalid SCHEDULE_CREATED event — missing scheduleId or seats');
          return;
     }

     const eventKey = `SCHEDULE_CREATED:${scheduleId}`;

     const existing = await prisma.idempotencyRecord.findUnique({ where: { eventKey } });
     if (existing) {
          logger.info(`Duplicate event skipped: ${eventKey}`);
          return;
     }

     const totalSeats = seats.length;

     await prisma.$transaction(async (tx) => {
          const schedule = await tx.scheduleInventory.create({
               data: {
                    scheduleId,
                    trainId,
                    trainNumber,
                    trainName,
                    departureDate: new Date(departureDate),
                    totalSeats,
                    available: totalSeats,
                    locked: 0,
                    booked: 0,
                    status: 'ACTIVE',
               },
          });

          const seatData = seats.map(seat => ({
               scheduleInventoryId: schedule.id,
               scheduleId,
               seatId: seat.seatId,
               seatNumber: seat.seatNumber,
               seatType: seat.seatType,
               price: seat.price,
               status: 'AVAILABLE',
          }));

          await tx.seatInventory.createMany({ data: seatData });

          // --- SEGMENT BOOKING: Persist route topology for segment overlap checks ---
          if (eventData.route && eventData.route.length > 0) {
               const routeStopData = eventData.route.map(rs => ({
                    scheduleId,
                    stationId: rs.stationId,
                    stationName: rs.stationName,
                    stationCode: rs.stationCode,
                    sequenceNumber: rs.sequenceNumber,
               }));
               await tx.routeStop.createMany({ data: routeStopData });
               logger.info(`Persisted ${routeStopData.length} route stops for schedule ${scheduleId}`);
          }

          await tx.idempotencyRecord.create({ data: { eventKey } });
     });

     logger.info(`Inventory initialized for schedule ${scheduleId} with ${totalSeats} seats`);

     try {
          await inventoryProducer.publishSeatAvailabilityUpdated(scheduleId, trainId, totalSeats, 0, 0);
     } catch (err) {
          logger.error('Failed to publish initial availability event after retries', { scheduleId, error: err.message });
     }
};

const cancelScheduleInventory = async (eventData) => {
     const data = eventData.data || eventData;
     const scheduleId = data.scheduleId || data.id;

     if (!scheduleId) {
          logger.warn('Invalid SCHEDULE_CANCELLED event — missing scheduleId');
          return;
     }

     const eventKey = `SCHEDULE_CANCELLED:${scheduleId}`;

     const existing = await prisma.idempotencyRecord.findUnique({ where: { eventKey } });
     if (existing) {
          logger.info(`Duplicate event skipped: ${eventKey}`);
          return;
     }

     const schedule = await prisma.scheduleInventory.findUnique({ where: { scheduleId } });
     if (!schedule) {
          logger.warn(`Schedule ${scheduleId} not found in inventory — skipping cancellation`);
          return;
     }

     await prisma.$transaction(async (tx) => {
          await tx.scheduleInventory.update({
               where: { scheduleId },
               data: { status: 'CANCELLED', available: 0, locked: 0, booked: 0, version: { increment: 1 } },
          });

          await tx.seatInventory.updateMany({
               where: { scheduleId },
               data: { status: 'CANCELLED' },
          });

          await tx.idempotencyRecord.create({ data: { eventKey } });
     });

     logger.info(`Inventory cancelled for schedule ${scheduleId}`);

     try {
          await inventoryProducer.publishSeatAvailabilityUpdated(scheduleId, schedule.trainId, 0, 0, 0);
     } catch (err) {
          logger.error('Failed to publish cancellation availability event after retries', { scheduleId, error: err.message });
     }
};


/**
 * Recompute SeatInventory.status for a set of seats based on their current
 * SeatSegmentLock rows.  Each physical seat gets exactly ONE summary status:
 *   - AVAILABLE  → no active segment locks at all
 *   - LOCKED     → at least one LOCKED segment lock exists
 *   - BOOKED     → all active segment locks are BOOKED (none LOCKED)
 *
 * Returns the count of seats whose status actually changed to/from AVAILABLE
 * so the caller can decide whether aggregate counters need adjusting.
 */
async function recomputeSegmentSeatStatuses(tx, scheduleId, seatIds) {
     const statusChanges = { nowAvailable: 0, nowOccupied: 0, lockedToBooked: 0, bookedToLocked: 0 };

     for (const seatId of seatIds) {
          const locks = await tx.seatSegmentLock.findMany({
               where: { scheduleId, seatId, status: { in: ['LOCKED', 'BOOKED'] } },
               select: { status: true },
          });

          // Determine the correct summary status
          let newStatus;
          if (locks.length === 0) {
               newStatus = 'AVAILABLE';
          } else if (locks.some(l => l.status === 'LOCKED')) {
               newStatus = 'LOCKED';
          } else {
               newStatus = 'BOOKED';
          }

          // Read current status to detect transitions
          const current = await tx.$queryRaw`
               SELECT status FROM seat_inventories
               WHERE "scheduleId" = ${scheduleId} AND "seatId" = ${seatId}
               FOR UPDATE NOWAIT
          `;
          const oldStatus = current[0]?.status;

          if (oldStatus === newStatus) continue; // no change needed

          // Track transitions for aggregate counter adjustment
          if (oldStatus === 'AVAILABLE' && newStatus !== 'AVAILABLE') statusChanges.nowOccupied++;
          if (oldStatus !== 'AVAILABLE' && newStatus === 'AVAILABLE') statusChanges.nowAvailable++;
          if (oldStatus === 'LOCKED' && newStatus === 'BOOKED') statusChanges.lockedToBooked++;
          if (oldStatus === 'BOOKED' && newStatus === 'LOCKED') statusChanges.bookedToLocked++;

          // Update the summary row
          await tx.$executeRaw`
               UPDATE seat_inventories
               SET status = ${newStatus}::"SeatStatus",
                   "lockedBy" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockedBy" END,
                   "lockedAt" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockedAt" END,
                   "lockExpiresAt" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "lockExpiresAt" END,
                   "bookingId" = CASE WHEN ${newStatus} = 'AVAILABLE' THEN NULL ELSE "bookingId" END,
                   version = version + 1, "updatedAt" = NOW()
               WHERE "scheduleId" = ${scheduleId} AND "seatId" = ${seatId}
          `;
     }

     return statusChanges;
}

/**
 * Recount schedule_inventories aggregate columns from actual seat_inventories rows.
 * This is the source of truth — avoids counter drift from arithmetic updates.
 */
async function recountScheduleAggregates(tx, scheduleId) {
     const counts = await tx.$queryRaw`
          SELECT
               COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS available,
               COUNT(*) FILTER (WHERE status = 'LOCKED')::int AS locked,
               COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked
          FROM seat_inventories
          WHERE "scheduleId" = ${scheduleId}
     `;

     const { available, locked, booked } = counts[0];

     await tx.$executeRaw`
          UPDATE schedule_inventories
          SET available = ${available}, locked = ${locked}, booked = ${booked},
              version = version + 1, "updatedAt" = NOW()
          WHERE "scheduleId" = ${scheduleId}
     `;

     return { available, locked, booked };
}

// ─── REST API Handlers ──────────────────────────────────────────────────────
const getAvailability = async (scheduleId) => {
     const schedule = await prisma.scheduleInventory.findUnique({ where: { scheduleId } });
     if (!schedule) throw new AppError('Schedule not found in inventory' , StatusCodes.NOT_FOUND);

     return {
          scheduleId: schedule.scheduleId,
          trainId: schedule.trainId,
          trainNumber: schedule.trainNumber,
          trainName: schedule.trainName,
          departureDate: schedule.departureDate,
          status: schedule.status,
          totalSeats: schedule.totalSeats,
          available: schedule.available,
          locked: schedule.locked,
          booked: schedule.booked,
     };
};

const getSeats = async (scheduleId, filters = {}) => {
     const schedule = await prisma.scheduleInventory.findUnique({ where: { scheduleId } });
     if (!schedule) throw new AppError('Schedule not found in inventory', StatusCodes.NotFoundError);

     const where = { scheduleId };
     if (filters.status) where.status = filters.status;
     if (filters.seatType) where.seatType = filters.seatType;

     let seats = await prisma.seatInventory.findMany({
          where,
          orderBy: { seatNumber: 'asc' },
          select: {
               seatId: true,
               seatNumber: true,
               seatType: true,
               price: true,
               status: true,
               lockedBy: true,
               lockExpiresAt: true,
               bookingId: true,
          },
     });

     // --- SEGMENT BOOKING: If segment specified, compute per-seat segment availability ---
     if (filters.fromSeq && filters.toSeq) {
          const fromSeq = parseInt(filters.fromSeq);
          const toSeq = parseInt(filters.toSeq);

          // Find all active segment locks that overlap with the requested segment
          const overlappingLocks = await prisma.seatSegmentLock.findMany({
               where: {
                    scheduleId,
                    status: { in: ['LOCKED', 'BOOKED'] },
                    fromSeq: { lt: toSeq },   // overlap condition: a.from < b.to
                    toSeq: { gt: fromSeq },    // overlap condition: b.from < a.to
               },
               select: { seatId: true, status: true },
          });

          const blockedSeatIds = new Set(overlappingLocks.map(l => l.seatId));

          // --- SEGMENT BOOKING: Find seats that have ANY segment locks (to distinguish legacy bookings) ---
          const seatsWithAnyLock = await prisma.seatSegmentLock.findMany({
               where: { scheduleId, status: { in: ['LOCKED', 'BOOKED'] } },
               select: { seatId: true },
               distinct: ['seatId'],
          });
          const seatsWithLocks = new Set(seatsWithAnyLock.map(l => l.seatId));

          // Add segmentStatus: UNAVAILABLE if overlapping lock exists, or if seat is
          // BOOKED/LOCKED with no segment locks at all (legacy pre-segment booking).
          // AVAILABLE only if no overlapping locks AND (seat has segment locks OR seat is AVAILABLE).
          seats = seats.map(seat => {
               if (blockedSeatIds.has(seat.seatId)) {
                    return { ...seat, segmentStatus: 'UNAVAILABLE' };
               }
               // Legacy booking: seat is BOOKED/LOCKED but has no segment lock records
               // → treat as booked for entire journey (backward compat)
               if ((seat.status === 'BOOKED' || seat.status === 'LOCKED') && !seatsWithLocks.has(seat.seatId)) {
                    return { ...seat, segmentStatus: 'UNAVAILABLE' };
               }
               return { ...seat, segmentStatus: 'AVAILABLE' };
          });
     }

     return {
          scheduleId,
          totalSeats: schedule.totalSeats,
          seats,
     };
};

// --- SEGMENT BOOKING: Added fromSeq/toSeq params for segment-aware locking ---
const lockSeats = async (scheduleId, seatIds, userId, ttlSeconds, fromSeq, toSeq) => {
     const ttl = Math.min(Math.max(ttlSeconds || config.LOCK_TTL_SECONDS, 60), 600);
     const lockExpiresAt = new Date(Date.now() + ttl * 1000);

     const result = await retryTransaction(async () => {
          return prisma.$transaction(async (tx) => {
               // Verify schedule is active
               const schedule = await tx.scheduleInventory.findUnique({ where: { scheduleId } });
               if (!schedule) throw new AppError('Schedule not found in inventory', StatusCodes.NOT_FOUND);
               if (schedule.status !== 'ACTIVE') throw new AppError('Schedule is not active', StatusCodes.BAD_REQUEST);

               // Row-level lock on requested seats
               const seats = await tx.$queryRaw`
                    SELECT id, "seatId", "seatNumber", status, "lockedBy"
                    FROM seat_inventories
                    WHERE "scheduleId" = ${scheduleId}
                    AND "seatId" = ANY(${seatIds}::text[])
                    FOR UPDATE NOWAIT
               `;

               // All seats must exist
               if (seats.length !== seatIds.length) {
                    const foundIds = new Set(seats.map(s => s.seatId));
                    const missing = seatIds.filter(id => !foundIds.has(id));
                    throw new AppError(`Seats not found: ${missing.join(', ')}`, StatusCodes.NOT_FOUND);
               }

               // --- SEGMENT BOOKING: Check segment-level availability instead of full-journey ---
               if (fromSeq && toSeq) {
                    // Check for overlapping segment locks on any of the requested seats
                    const overlapping = await tx.$queryRaw`
                         SELECT "seatId" FROM seat_segment_locks
                         WHERE "scheduleId" = ${scheduleId}
                         AND "seatId" = ANY(${seatIds}::text[])
                         AND status IN ('LOCKED', 'BOOKED')
                         AND "fromSeq" < ${toSeq}
                         AND "toSeq" > ${fromSeq}
                         FOR UPDATE NOWAIT
                    `;

                    if (overlapping.length > 0) {
                         const blockedIds = [...new Set(overlapping.map(r => r.seatId))];
                         throw new AppError(
                              `Seats already locked/booked for overlapping segment: ${blockedIds.join(', ')}, SEATS_UNAVAILABLE`,
                              StatusCodes.CONFLICT   
                         );
                    }

                    // Create segment lock rows for the requested segment
                    for (const seat of seats) {
                         await tx.seatSegmentLock.create({
                              data: {
                                   scheduleId,
                                   seatId: seat.seatId,
                                   fromSeq,
                                   toSeq,
                                   status: 'LOCKED',
                                   lockedBy: userId,
                                   lockedAt: new Date(),
                                   lockExpiresAt,
                              },
                         });
                    }
               } else {
                    // Fallback: full-journey lock (no segment) — all seats must be AVAILABLE
                    const unavailable = seats.filter(s => s.status !== 'AVAILABLE');
                    if (unavailable.length > 0) {
                         throw new AppError(
                              `Seats not available: ${unavailable.map(s => `seat #${s.seatNumber} is ${s.status}`).join(', ')}, SEATS_UNAVAILABLE`,
                              StatusCodes.CONFLICT
                         );
                    }
               }

               // --- SEGMENT BOOKING: Recompute seat statuses from segment locks ---
               if (fromSeq && toSeq) {
                    // Set lockedBy/lockedAt/lockExpiresAt on seats that didn't have it yet
                    const seatPkIds = seats.map(s => s.id);
                    await tx.$executeRaw`
                         UPDATE seat_inventories
                         SET "lockedBy" = COALESCE("lockedBy", ${userId}),
                             "lockedAt" = COALESCE("lockedAt", NOW()),
                             "lockExpiresAt" = ${lockExpiresAt}::timestamp,
                             "updatedAt" = NOW()
                         WHERE id = ANY(${seatPkIds}::text[])
                    `;

                    // Recompute each seat's summary status from its segment locks
                    const affectedSeatIds = seats.map(s => s.seatId);
                    await recomputeSegmentSeatStatuses(tx, scheduleId, affectedSeatIds);

                    // Recount aggregates from actual seat rows (prevents counter drift)
                    const counts = await recountScheduleAggregates(tx, scheduleId);

                    return {
                         scheduleId,
                         trainId: schedule.trainId,
                         lockedSeats: seats.map(s => ({
                              seatId: s.seatId,
                              seatNumber: s.seatNumber,
                              lockExpiresAt,
                         })),
                         lockExpiresAt,
                         counts,
                    };
               }

               // Full-journey: unconditional lock (original fast path)
               const seatPkIds = seats.map(s => s.id);
               await tx.$executeRaw`
                    UPDATE seat_inventories
                    SET status = 'LOCKED', "lockedBy" = ${userId},
                        "lockedAt" = NOW(), "lockExpiresAt" = ${lockExpiresAt}::timestamp,
                        version = version + 1, "updatedAt" = NOW()
                    WHERE id = ANY(${seatPkIds}::text[])
               `;

               await tx.$executeRaw`
                    UPDATE schedule_inventories
                    SET available = available - ${seats.length},
                        locked = locked + ${seats.length},
                        version = version + 1,
                        "updatedAt" = NOW()
                    WHERE "scheduleId" = ${scheduleId}
               `;

               return {
                    scheduleId,
                    trainId: schedule.trainId,
                    lockedSeats: seats.map(s => ({
                         seatId: s.seatId,
                         seatNumber: s.seatNumber,
                         lockExpiresAt,
                    })),
                    lockExpiresAt,
                    counts: {
                         available: schedule.available - seats.length,
                         locked: schedule.locked + seats.length,
                         booked: schedule.booked,
                    },
               };
          }, { timeout: 10000 });
     });

     // Publish availability update (fire and forget)
     try {
          await inventoryProducer.publishSeatAvailabilityUpdated(
               result.scheduleId, result.trainId,
               result.counts.available, result.counts.locked, result.counts.booked
          );
     } catch (err) {
          logger.error('Failed to publish availability after lock', { scheduleId: result.scheduleId, error: err.message });
     }

     return result;
};




const inventoryService = {
     initializeInventory,
     cancelScheduleInventory,
     getAvailability,
     getSeats,
     lockSeats,
     recomputeSegmentSeatStatuses,
     recountScheduleAggregates,
}
export default inventoryService;