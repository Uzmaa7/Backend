import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import logger from "./config/logger.js";
import { config } from "./config/index.js";

import { reqLogger } from "./middlewares/req.middleware.js";
import { corsMiddleware } from "./middlewares/cors.middleware.js";

import routes from "../src/routes/index.js";

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(reqLogger);
app.use(corsMiddleware);



app.get('/health', (req, res) => {
     res.status(200).json({
          success: true,
          message: 'API Gateway is running',
          timestamp: new Date().toISOString(),
          environment: config.NODE_ENV,
     });
});

app.use('/api', routes);


const gracefulShutdown = () => {
     logger.info('Received shutdown signal, closing server gracefully...');
     server.close(() => {
          logger.info('Server closed');
          process.exit(0);
     });

     setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
     }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);


const server = app.listen(config.PORT, () => {
     logger.info(`🚀 API Gateway running on port ${config.PORT} in ${config.NODE_ENV} mode`);
});

process.on('unhandledRejection', (err) => {
     logger.error('Unhandled Rejection:', err);
     server.close(() => process.exit(1));
});

export default app;