import { StatusCodes } from 'http-status-codes';
import AppError from '../../../../booking-service/src/utils/errors/appError';

import Razorpay from 'razorpay';
import BaseGateway from './base.gateway.js';
import  logger from '../../config/logger.js';

class RazorpayGateway extends BaseGateway {
     constructor(keyId, keySecret, webhookSecret) {
          super('razorpay');
          this.keyId = keyId;
          this.keySecret = keySecret;
          this.webhookSecret = webhookSecret;
          this.client = new Razorpay({
               key_id: keyId,
               key_secret: keySecret,
          });
     }

     async createOrder(amount, currency, receipt, notes = {}) {
          const amountInPaise = Math.round(amount * 100);

          let order;
          try {
               order = await this.client.orders.create({
                    amount: amountInPaise,
                    currency,
                    receipt,
                    notes,
               });
          } catch (err) {
               // Razorpay SDK throws plain objects, not Error instances
               const description = err?.error?.description || err?.message || JSON.stringify(err);
               logger.error(`Razorpay createOrder failed: ${description}`);
               
               throw new AppError(`Payment gateway error: ${description}, PAYMENT_GATEWAY_ERROR`, StatusCodes.BAD_REQUEST);
          }

          logger.info(`Razorpay order created: ${order.id}`, { receipt, amount });

          return {
               gatewayOrderId: order.id,
               amount: order.amount / 100,
               currency: order.currency,
               receipt: order.receipt,
               rawResponse: order,
          };
     }


}

export default RazorpayGateway;