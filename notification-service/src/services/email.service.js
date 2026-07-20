import sgMail from '@sendgrid/mail';
import { StatusCodes } from 'http-status-codes';
import logger from '../config/logger.js';
import { config } from '../config/index.js';
import AppError from '../utils/errors/appError.js';
import { getOtpTemplate, getWelcomeTemplate } from '../templates/index.js'; 

sgMail.setApiKey(config.SENDGRID_API_KEY);

sgMail.client.setDefaultRequest('timeout', 5000);

class EmailService {
     constructor() {
          this.from = config.MAIL_SEND
          this.maxRetries = 3;
     }

     async sendWithRetry(msg, retries = 0) {
          try {
               await sgMail.send(msg);
               logger.info(`Email sent successfully to ${msg.to}`, {
                    subject: msg.subject,
                    attempt: retries + 1
               });
               return { success: true };
          } catch (error) {
               logger.error(`Email sending failed (attempt ${retries + 1}/${this.maxRetries})`, {
                    to: msg.to,
                    error: error.message,
                    code: error.code,
               });

               if (retries < this.maxRetries - 1) {
                    const delay = Math.pow(2, retries) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.sendWithRetry(msg, retries + 1);
               }

               throw error;
          }
     }

     async sendOtpEmail(email, otp, ttlMinutes) {
          const msg = {
               to: email,
               from: this.from,
               subject: 'Your Backend verification code',
               html: getOtpTemplate(otp, ttlMinutes),
          };

          return this.sendWithRetry(msg);
     }

     async sendWelcomeEmail(email, firstName) {
          const msg = {
               to: email,
               from: this.from,
               subject: 'Welcome to DesignKarle - Email Verified',
               html: getWelcomeTemplate(firstName),
          };

          return this.sendWithRetry(msg);
     }
}

export default new EmailService();