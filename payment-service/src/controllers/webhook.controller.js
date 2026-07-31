import { StatusCodes } from "http-status-codes";
import AppError from "../../../booking-service/src/utils/errors/appError.js";
import { SuccessResponse, ErrorResponse } from "../../../inventory-service/src/utils/common/index.js";
import logger from "../config/logger.js";
import paymentService from "../services/payment.service.js";

/**
 * Razorpay webhook handler.
 * IMPORTANT: This endpoint receives raw body (not JSON-parsed)
 * for signature verification. The route must use express.raw().
 */
export const razorpayWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-razorpay-signature'];

        if (!signature) {
            logger.warn('Webhook received without signature header');

            ErrorResponse.error = {
                    explanation: 'Missing signature header'
               };
               ErrorResponse.message = 'Missing x-razorpay-signature header';

               return res
                    .status(StatusCodes.BAD_REQUEST)
                    .json(ErrorResponse);
        }

        const rawBody = req.body;

        const result = await paymentService.handleWebhook(rawBody, signature);

        logger.info('Webhook processed', { result });

        // Always return 200 to the gateway to prevent retries for processed events
        SuccessResponse.data = result;
        SuccessResponse.message = "Webhook processed successfully";

        return res
            .status(StatusCodes.OK)
            .json(SuccessResponse);

    } catch (error) {
        logger.error("Error in razorpayWebhook controller:", error);

        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
        ErrorResponse.error = error;

        return res
            .status(statusCode)
            .json(ErrorResponse);
    }
};