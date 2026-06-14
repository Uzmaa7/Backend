import config from "./index.js"
import winston from "winston";


const logger = winston.createLogger({
    level: config.NODE_ENV === "production" ? 'info' : 'debug',
    defaultMeta: {service: config.SERVICE_NAME},

    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss"}),
        winston.format.printf(({level, message, timestamp, service}) => {
            return `${timestamp} ${level} [${service}] : ${message}`
        })    

    ),

    transports: [
        new winston.transports.File({filename: "logs/error.log", level: "error"}),
        new winston.transports.File({filename: "logs/combined.log"})
    ],
})

if (config.NODE_ENV !== "production") {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }))
}

export default logger;