import prisma from "../../../inventory-service/src/config/prisma.js";
import { config } from "../../../booking-service/src/config";
import logger from "../../../booking-service/src/config/logger.js";
import AppError from "../../../booking-service/src/utils/errors/appError.js";
import { StatusCodes } from "http-status-codes";
import paymentProducer from "../kafka/producer/payment.producer.js";

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

// ─── Verify and Capture (client-side verification) ───────────────────────────

const verifyAndCapturePayment = async (paymentOrderId, gatewayPaymentId, gatewaySignature) => {
     if (!paymentOrderId || !gatewayPaymentId || !gatewaySignature) {
          throw new AppError('paymentOrderId, gatewayPaymentId, and gatewaySignature are required', StatusCodes.BAD_REQUEST);
     }

     const paymentOrder = await prisma.paymentOrder.findUnique({
          where: { id: paymentOrderId },
     });

     if (!paymentOrder) {
          throw new AppError('Payment order not found', StatusCodes.NOT_FOUND);
     }

     // Idempotent
     if (paymentOrder.status === 'CAPTURED') {
          return {
               paymentOrderId: paymentOrder.id,
               status: 'CAPTURED',
               gatewayPaymentId: paymentOrder.gatewayPaymentId,
               message: 'Payment already captured',
          };
     }

     if (paymentOrder.status !== 'CREATED') {
          throw new AppError(`Payment order is in ${paymentOrder.status} status`, StatusCodes.CONFLICT);
     }

     const gateway = getGateway();

     // Verify signature
     const isValid = gateway.verifyPaymentSignature(
          paymentOrder.gatewayOrderId,
          gatewayPaymentId,
          gatewaySignature
     );

     // Audit log the verification attempt
     await prisma.paymentAuditLog.create({
          data: {
               paymentOrderId: paymentOrder.id,
               action: isValid ? 'SIGNATURE_VERIFIED' : 'SIGNATURE_VERIFICATION_FAILED',
               metadata: { gatewayPaymentId, isValid },
          },
     });

     if (!isValid) {
          await prisma.paymentOrder.update({
               where: { id: paymentOrder.id },
               data: {
                    status: 'FAILED',
                    failureReason: 'signature_verification_failed',
                    version: { increment: 1 },
               },
          });

          // Publish failure
          await paymentProducer.publishPaymentFailed(
               paymentOrder.id,
               paymentOrder.bookingId,
               'signature_verification_failed'
          ).catch(err => {
               logger.error('Failed to publish PAYMENT_FAILED after sig failure', { error: err.message });
          });

          throw new AppError('Payment signature verification failed, INVALID_SIGNATURE', StatusCodes.BAD_REQUEST);
     }

     // Signature valid — capture payment
     await prisma.paymentOrder.update({
          where: { id: paymentOrder.id },
          data: {
               status: 'CAPTURED',
               gatewayPaymentId,
               gatewaySignature,
               version: { increment: 1 },
          },
     });

     await prisma.paymentAuditLog.create({
          data: {
               paymentOrderId: paymentOrder.id,
               action: 'PAYMENT_CAPTURED_VIA_VERIFY',
               metadata: { gatewayPaymentId },
          },
     });

     logger.info(`Payment captured via verify: ${paymentOrder.id}`);

     // Publish PAYMENT_SUCCESS
     await paymentProducer.publishPaymentSuccess(
          paymentOrder.id,
          paymentOrder.bookingId,
          gatewayPaymentId,
          paymentOrder.amount
     ).catch(err => {
          logger.error('Failed to publish PAYMENT_SUCCESS after verify', { error: err.message });
     });

     return {
          paymentOrderId: paymentOrder.id,
          status: 'CAPTURED',
          gatewayPaymentId,
     };
};

const paymentService = {
    createPaymentOrder,
    verifyAndCapturePayment,
}

export default paymentService;