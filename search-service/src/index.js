import 'dotenv/config';

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Config and Logger Imports
import { config } from './config/index.js';
import logger from './config/logger.js';
import { initIndices, recreateIndices } from './config/elasticsearch.js';

// Middlewares Imports
import { corsMiddleware } from './middlewares/cors.middleware.js';
import { reqLogger } from './middlewares/req.middleware.js';

// Routes & Kafka Imports
import searchConsumer from './kafka/search.consumer.js';
import { disconnectAll } from './config/kafka.js';
import searchRoutes from "../src/routes/search.route.js";

const app = express();

app.use(helmet());import 'dotenv/config';



app.use(helmet());
app.use(reqLogger);
app.use(express.json());
app.use(cookieParser());
app.use(corsMiddleware);

app.use(searchRoutes);

app.get("/health", (req, res) => {
    res.status(200).json({
        message: "search service is healthy"
    })
})



const startServer = async () => {
     if (process.env.ES_RECREATE_INDICES === 'true') {
          await recreateIndices();
     } else {
          await initIndices();
     }
     await searchConsumer.start();

     const server = app.listen(config.PORT, () => {
          logger.info(`${config.SERVICE_NAME} running on http://localhost:${config.PORT}`);
     });

     const shutdown = async () => {
          logger.info('Shutting down...');
          server.close(async () => {
               await disconnectAll();
               process.exit(0);
          });
     };
     process.on('SIGTERM', shutdown);
     process.on('SIGINT', shutdown);
};

startServer();
