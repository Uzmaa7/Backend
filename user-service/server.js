import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import logger from "./src/config/logger.js";
import {config} from "./src/config/index.js";

import { reqLogger } from "./src/middlewares/req.middleware.js";
import { corsMiddleware } from "./src/middlewares/cors.middleware.js";

import authRoutes from "./src/routes/auth.route.js";
import userRoutes from "./src/routes/user.route.js";

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(reqLogger);
app.use(corsMiddleware);


app.use("/auth", authRoutes);
app.use("/user", userRoutes);

app.get("/", (req, res) => {
     res.send("Hello from server.js of user-service");
})

app.get("/health", (req, res) => {
    res.status(200).json({
        message: "Service is healthy"
    })
})


async function startServer() {
    try {
        
        const server = app.listen(config.PORT, () => {
            logger.info(`${config.SERVICE_NAME} is running on http://localhost:${config.PORT}`)
        })

    } catch (error) {
        logger.error("Failed to start Server", error);
        process.exit(1);
    }
}

startServer();