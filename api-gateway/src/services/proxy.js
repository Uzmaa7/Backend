import {config} from "../config/index.js";
import logger from "../config/logger.js";
import { StatusCodes } from "http-status-codes";
import AppError from "../utils/error/appError.js";

/**
 * Circuit Breaker implementation
 * Prevents cascading failures when downstream services are down
 */
class CircuitBreaker {
     constructor(serviceName, threshold = config.CIRCUIT_BREAKER_THRESHOLD, timeout = config.CIRCUIT_BREAKER_TIMEOUT) {
          this.serviceName = serviceName;
          this.failureCount = 0;
          this.threshold = threshold;
          this.timeout = timeout;
          this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
          this.nextAttempt = Date.now();
     }

     async execute(request) {
          if (this.state === 'OPEN') {
                // can we perform the next attempt?
               if (Date.now() < this.nextAttempt) {
                    throw new AppError(
                         `Service ${this.serviceName} is temporarily unavailable. Circuit breaker is OPEN.`,
                         StatusCodes.SERVICE_UNAVAILABLE
                    );
               }
               // Try to close the circuit
               this.state = 'HALF_OPEN';
               logger.info(`Circuit breaker HALF_OPEN for ${this.serviceName}`);
          }

          try {
               const response = await request();
               this.onSuccess();
               return response;
          } catch (err) {

               this.onFailure();
               
               if (err instanceof AppError) {
                    throw err;
               }

               throw new AppError(
                    `Dependency service failure via CircuitBreaker [${this.serviceName}]: ${err.message}`, 
                    StatusCodes.INTERNAL_SERVER_ERROR
               );
          }
     }

     async onSuccess() {
          this.failureCount = 0;
          if (this.state === 'HALF_OPEN') {
               this.state = 'CLOSED';
               logger.info(`Circuit breaker CLOSED for ${this.serviceName}`);
          }
     }

     async onFailure() {
          this.failureCount++;
          if (this.failureCount >= this.threshold) {
               this.state = 'OPEN';
               this.nextAttempt = Date.now() + this.timeout;
               logger.error(
                    `Circuit breaker OPEN for ${this.serviceName}. Next attempt at ${new Date(this.nextAttempt).toISOString()}`
               );
          }
     }

     getState() {
          return {
               service: this.serviceName,
               state: this.state,
               failureCount: this.failureCount,
               nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
          };
     }
}


// Circuit breakers for each service
const circuitBreakers = {
     userService: new CircuitBreaker('user-service'),
     searchService: new CircuitBreaker('search-service'),
     bookingService: new CircuitBreaker('booking-service')
};