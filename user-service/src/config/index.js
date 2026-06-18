import dotenv from "dotenv";
import packageJson from "../../package.json" with { type: "json" };

dotenv.config()

const config = {
    SERVICE_NAME: packageJson.name,
    PORT: Number(process.env.PORT) || 4001,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",

    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    DATABASE_URL:process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,


    OTP_TTL: process.env.OTP_TTL || 300,
    OTP_RATE_MAX_PER_HOUR: process.env.OTP_RATE_MAX_PER_HOUR || 5,
    OTP_MAX_VERIFY_ATTEMPTS: process.env.OTP_MAX_VERIFY_ATTEMPTS || 5,
    OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET,

    MAIL_SEND: process.env.MAIL_SEND,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,

}

export {config};