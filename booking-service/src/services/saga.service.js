import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { inventoryClient } from './inventoryClient.js';


/**
 * Saga orchestrator for booking lifecycle.
 * Each step is logged to SagaLog for auditability and crash recovery.
 *
 * Forward flow: HOLD_SEATS -> CREATE_PAYMENT -> CONFIRM_SEATS -> COMPLETE
 * Compensation: reverse order of completed steps
 */

// ─── Forward Steps ───────────────────────────────────────────────────────────

// --- SEGMENT BOOKING: Added fromSeq/toSeq params ---
async function executeHoldSeats(booking, seatIds, ttlSeconds, fromSeq, toSeq) {
    const sagaLog = await prisma.sagaLog.create({
        data: {
            bookingId: booking.id,
            step: 'HOLD_SEATS',
            status: 'PENDING',
            request: { scheduleId: booking.scheduleId, seatIds, userId: booking.userId, ttlSeconds, fromSeq, toSeq }, // --- SEGMENT BOOKING
        },
    });

    try {
        const result = await inventoryClient.holdSeats(
            booking.scheduleId,
            seatIds,
            booking.userId,
            ttlSeconds,
            fromSeq,  // --- SEGMENT BOOKING
            toSeq     // --- SEGMENT BOOKING
        );

        await prisma.sagaLog.update({
            where: { id: sagaLog.id },
            data: { status: 'COMPLETED', response: result },
        });

        await prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'SEATS_HELD' },
        });

        logger.info(`Saga HOLD_SEATS completed for booking ${booking.id}`);
        return result;

    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        await prisma.sagaLog.update({
            where: { id: sagaLog.id },
            data: { status: 'FAILED', error: errorMsg },
        });
        throw error;
    }
}





export const saga = {
    executeHoldSeats,

};