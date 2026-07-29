import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import logger from "../config/logger.js";
import { config } from "../config/index.js";
import { inventoryClient } from "./inventoryClient.js";
import { saga } from "../services/saga.service.js";
import { acquireSeatLocks, releaseSeatLocks } from "../utils/distributedLock.js";
import idempotencyRepository from "../repositories/idempotencyRepository.js";


// ─── Create Booking ──────────────────────────────────────────────────────────

class BookingService {
    constructor(bookingRepository, idempotencyRepository) {
        this.bookingRepository = bookingRepository;
        this.idempotencyRepository = idempotencyRepository;
    }

    // ─── Idempotency Helper ──────────────────────────────────────────────────────

async checkIdempotency(key){
    const existing = await this.idempotencyRepository.findByKey(key);
    if (existing) {
        logger.info(`Idempotent request: ${key}`);
        return existing.response;
    }
    return null;
};

async saveIdempotency(key, response) {
        await this.idempotencyRepository.saveKey(key, response);
    }

    async createBooking(userId, scheduleId, seatIds, passengers, idempotencyKey,
        fromStationId, toStationId, fromSeq, toSeq) {

        // 1. Validate input
        if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
            throw new AppError("scheduleId and seatIds (non empty array) are required", StatusCodes.BAD_REQUEST);
        }

        if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
            throw new AppError("passengers(non empty array) is required", StatusCodes.BAD_REQUEST);
        }

        if (seatIds.length !== passengers.length) {
            throw new AppError("Number of seats must be match with number of passengers", StatusCodes.BAD_REQUEST);
        }

        if (!idempotencyKey) {
            throw new AppError("idempotency is required", StatusCodes.BAD_REQUEST);
        }

        // --- SEGMENT BOOKING: Validate segment params if provided ---
        if (fromSeq && toSeq && fromSeq >= toSeq) {
            throw new AppError("fromStation must come before toStation", StatusCodes.BAD_REQUEST);
        }

        // 2. Check idempotency
        const cached = await this.checkIdempotency(`booking:${idempotencyKey}`);
        if (cached) return cached;

        // 3. Fetch schedule availability and seat details from inventory
        const availability = await inventoryClient.getAvailability(scheduleId);
        if (availability.status !== "ACTIVE") {
            throw new AppError("Schedule is not ACTIVE", StatusCodes.BAD_REQUEST);
        }

        // Prevent booking trains that have already departed
        if (new Date(availability.departureDate) < new Date()) {
            throw new AppError("Cannot book a train that has already departed", StatusCodes.BAD_REQUEST);
        }

        // --- SEGMENT BOOKING: Pass segment params to get segment-aware seat availability ---
        const seatData = await inventoryClient.getSeats(scheduleId,
            {
                fromSeq: fromSeq || undefined,
                toSeq: toSeq || undefined,
            }
        )

        const seatMap = new Map(seatData.seats.map((s) => [s.seatId, s]));

        // Verify all requested seats - exist and are available
        const bookingSeats = [];
        let totalAmount = 0;

        for (const seatId of seatIds) {
            const seat = seatMap.get(seatId);
            if (!seat) {
                throw new AppError(`Seat ${seatId} not found in schedule`, StatusCodes.NOT_FOUND);
            }

            // --- SEGMENT BOOKING: Use segmentStatus when available for segment-aware validation ---
            const isAvailable = (fromSeq && toSeq && seat.segmentStatus !== undefined)
                ? seat.segmentStatus === 'AVAILABLE'
                : seat.status === 'AVAILABLE';

            if (!isAvailable) {
                throw new AppError(`Seat #${seat.seatNumber} is not available for this segment, SEATS_UNAVAILABLE`, StatusCodes.CONFLICT);
            }

            bookingSeats.push(seat);
            totalAmount += seat.price;
        }

        // 4. Sort seatIds (deadlock prevention for distributed locks)
        // const sortedSeatIds = seatIds.sort(); // ❌ Original 'seatIds' array would change
        const sortedSeatIds = [...seatIds].sort();

        // 5. Acquire Redis distributed locks (segment-aware keys for segment bookings)
        const { acquired, lockValue } = await acquireSeatLocks(
            scheduleId,
            sortedSeatIds,
            `pre-${Date.now()}`, // temporary ID before booking is created
            config.BOOKING_TTL_SECONDS,
            fromSeq,  // --- SEGMENT BOOKING: include in lock key
            toSeq     // --- SEGMENT BOOKING: include in lock key
        );

        if (!acquired) {
            throw new AppError('One or more seats are being booked by another user. Please try again. SEATS_LOCKED', StatusCodes.CONFLICT);
        }

        let booking;

        try {

            // 6. Create booking record in DB
            const lockExpiresAt = new Date(Date.now() + config.BOOKING_TTL_SECONDS * 1000);

            const bookingData = {
                userId,
                scheduleId,
                trainId: availability.trainId,
                trainNumber: availability.trainNumber,
                trainName: availability.trainName,
                departureDate: new Date(availability.departureDate),
                status: 'PENDING',
                totalAmount,
                seatCount: seatIds.length,
                fromStationId: fromStationId || null,  // --- SEGMENT BOOKING
                toStationId: toStationId || null,      // --- SEGMENT BOOKING
                fromSeq: fromSeq || null,              // --- SEGMENT BOOKING
                toSeq: toSeq || null,                  // --- SEGMENT BOOKING
                idempotencyKey,
                lockExpiresAt,
                seats: {
                    create: bookingSeats.map((seat, index) => ({
                        seatId: seat.seatId,
                        seatNumber: seat.seatNumber,
                        seatType: seat.seatType,
                        price: seat.price,
                    })),
                },
                passengers: {
                    create: passengers.map((p, index) => ({
                        name: p.name,
                        age: p.age,
                        gender: p.gender,
                        seatId: seatIds[index] || null, // use original order to match user's intended seat assignment
                    })),
                },
            }

            const includeOptions = {
                seats: true,
                passengers: true,
            };

            booking = await this.bookingRepository.createBookingWithDetails(bookingData, includeOptions);


            // 7. Execute saga Step 1: Hold seats in inventory
            await saga.executeHoldSeats(booking, sortedSeatIds, config.LOCK_TTL_SECONDS, fromSeq, toSeq); // --- SEGMENT BOOKING

            // 8. Execute saga Step 2: Create payment order
            const paymentOrder = await saga.executeCreatePayment();

            // Refresh booking after updates
            booking = await this.bookingRepository.findBookingWithDetails(booking.id, {
                seats: true,
                passengers: true
            });

            // 9. Save idempotency
            const response = {
                bookingId: booking.id,
                status: booking.status,
                totalAmount: booking.totalAmount,
                lockExpiresAt: booking.lockExpiresAt,
                seats: booking.seats.map(s => ({
                    seatId: s.seatId,
                    seatNumber: s.seatNumber,
                    seatType: s.seatType,
                    price: s.price,
                })),
                passengers: booking.passengers.map(p => ({
                    name: p.name,
                    age: p.age,
                    gender: p.gender,
                })),
                paymentOrder: {
                    paymentOrderId: paymentOrder.paymentOrderId,
                    gatewayOrderId: paymentOrder.gatewayOrderId,
                    amount: paymentOrder.amount,
                    currency: paymentOrder.currency,
                    keyId: paymentOrder.keyId,
                },
            };

            await this.saveIdempotency(`booking:${idempotencyKey}`, response);

            return response;

        } catch (error) {
            // Compensate on failure
            logger.error(`Booking creation failed for user ${userId}`, { error: error.message });

            if (booking) {
                await saga.compensateAll(booking, sortedSeatIds);
                await prisma.booking.update({
                    where: { id: booking.id },
                    data: {
                        status: 'FAILED',
                        failureReason: error.response?.data?.message || error.message,
                    },
                });
            }

            // Release Redis locks (segment-aware)
            await releaseSeatLocks(scheduleId, sortedSeatIds, lockValue, fromSeq, toSeq);

            throw error;

        }
    }
}