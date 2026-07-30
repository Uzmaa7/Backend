import { StatusCodes } from "http-status-codes";
import AppError from "../../../booking-service/src/utils/errors/appError.js";
import { SuccessResponse, ErrorResponse } from "../../../inventory-service/src/utils/common/index.js";
import logger from "../config/logger.js";
import paymentService from "../services/payment.service.js";

export const createPaymentOrder = async (req, res, next) => {
     try {
          const { bookingId, amount, userId, idempotencyKey } = req.body;

          if (!bookingId || !amount || !userId || !idempotencyKey) {
               throw new AppError('bookingId, amount, userId, and idempotencyKey are required', StatusCodes.BAD_REQUEST);
          }

          const result = await paymentService.createPaymentOrder(bookingId, amount, userId, idempotencyKey);

          SuccessResponse.data = result;
          SuccessResponse.message = "Payment Order created Successfully";

          return res
               .status(StatusCodes.CREATED)
               .json(SuccessResponse);

     } catch (error) {
          logger.error("Error in createPaymentOrder controller:", error);

          const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
          ErrorResponse.error = error;

          return res
               .status(statusCode)
               .json(ErrorResponse);
     }
};


export const verifyAndCapturePayment = async (req, res, next) => {
     try {
          const { paymentOrderId } = req.params;
          const { gatewayPaymentId, gatewaySignature } = req.body;

          if (!gatewayPaymentId || !gatewaySignature) {
               throw new AppError('gatewayPaymentId and gatewaySignature are required', StatusCodes.BAD_REQUEST);
          }

          const result = await paymentService.verifyAndCapturePayment(
               paymentOrderId,
               gatewayPaymentId,
               gatewaySignature
          );


          SuccessResponse.data = result;
          SuccessResponse.message = "verify and Capture Payment Successfully";

          return res
               .status(StatusCodes.OK)
               .json(SuccessResponse);


     } catch (error) {
          logger.error("Error in verifyAndCapturePayment controller:", error);

          const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
          ErrorResponse.error = error;

          return res
               .status(statusCode)
               .json(ErrorResponse);
     }
};