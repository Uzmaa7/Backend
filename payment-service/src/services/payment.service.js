import prisma from "../../../inventory-service/src/config/prisma.js";
import { config } from "../../../booking-service/src/config";
import logger from "../../../booking-service/src/config/logger.js";
import AppError from "../../../booking-service/src/utils/errors/appError.js";
import { StatusCodes } from "http-status-codes";

// ─── Idempotency Helper ──────────────────────────────────────────────────────

const withIdempotency = async (key, fn) => {
    const existing = await prisma.idempotencyRecord.findUnique({ where: { eventKey: key } });
    if (existing) {
        logger.info(`Idempotent request detected: ${key}`);
        return existing.response;
    }

    const result = await fn();

    await prisma.idempotencyRecord.create({
        data: { eventKey: key, response: result },
    });

    return result;
};


// ─── Create Payment Order ────────────────────────────────────────────────────

const createPaymentOrder = async (bookingId, amount, userId, idempotencyKey) => {
    if (!bookingId || !amount || !userId || !idempotencyKey) {
        throw new AppError('bookingId, amount, userId, and idempotencyKey are required', StatusCodes.BAD_REQUEST);
    }

    if (amount <= 0) {
        throw new AppError('Amount must be greater than 0', StatusCodes.BAD_REQUEST);
    }

    return withIdempotency(`payment-order:${idempotencyKey}`, async () => {
        const gateway = getGateway();

        // Create order with gateway
        const gatewayResult = await gateway.createOrder(amount, 'INR', bookingId, {
            bookingId,
            userId,
        });

        // Create payment order record
        const paymentOrder = await prisma.paymentOrder.create({
            data: {
                bookingId,
                userId,
                amount,
                currency: 'INR',
                status: 'CREATED',
                idempotencyKey,
                gatewayProvider: config.PAYMENT_GATEWAY,
                gatewayOrderId: gatewayResult.gatewayOrderId,
            },
        });

        // Audit log
        await prisma.paymentAuditLog.create({
            data: {
                paymentOrderId: paymentOrder.id,
                action: 'ORDER_CREATED',
                gatewayResponse: gatewayResult.rawResponse,
                metadata: { bookingId, userId, amount },
            },
        });

        logger.info(`Payment order created: ${paymentOrder.id}`, {
            bookingId,
            gatewayOrderId: gatewayResult.gatewayOrderId,
        });

        return {
            paymentOrderId: paymentOrder.id,
            gatewayOrderId: gatewayResult.gatewayOrderId,
            amount: paymentOrder.amount,
            currency: paymentOrder.currency,
            status: paymentOrder.status,
            gatewayProvider: paymentOrder.gatewayProvider,
            keyId: config.RAZORPAY_KEY_ID,
        };
    });
}

const paymentService = {
    createPaymentOrder,

}

export default paymentService;