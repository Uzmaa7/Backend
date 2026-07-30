/**
 * Abstract base class defining the payment gateway interface.
 * All gateway implementations must extend this and implement every method.
 * This enables the adapter pattern — swap gateways without touching business logic.
 */
class BaseGateway {
     constructor(providerName) {
          if (new.target === BaseGateway) {
               throw new Error('BaseGateway is abstract and cannot be instantiated directly');
          }
          this.providerName = providerName;
     }

     /**
      * Create a payment order with the gateway.
      * @param {number} amount - Amount in base currency (e.g., INR, not paise)
      * @param {string} currency - Currency code (e.g., "INR")
      * @param {string} receipt - Unique receipt/reference ID (typically bookingId)
      * @param {object} notes - Additional metadata
      * @returns {Promise<{ gatewayOrderId: string, amount: number, currency: string, receipt: string, rawResponse: object }>}
      */
     async createOrder(amount, currency, receipt, notes = {}) {
          throw new Error('createOrder() must be implemented by gateway');
     }

     
}

export default BaseGateway;