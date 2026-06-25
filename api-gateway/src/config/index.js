import packageJson from "../../package.json" with { type: "json" };
import dotenv from "dotenv";
dotenv.config();


const config = {
     PORT: process.env.PORT || 4000,

     SERVICE_NAME: packageJson.name,

     NODE_ENV: process.env.NODE_ENV || 'development',

     REDIS_URL: process.env.REDIS_URL,

     ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',

    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXP: process.env.ACCESS_TOKEN_EXP,
    ACCESS_TOKEN_EXP_SEC: Number(process.env.ACCESS_TOKEN_EXP_Sec),
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXP: process.env.REFRESH_TOKEN_EXP,
    REFRESH_TOKEN_EXP_SEC: Number(process.env.REFRESH_TOKEN_EXP_SEC),

    CIRCUIT_BREAKER_THRESHOLD:parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    CIRCUIT_BREAKER_TIMEOUT:parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000', 10),

    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
     RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

     
    SERVICES: {
          USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:4001',
          NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004',

     },

     SERVICE_TIMEOUT_MS: parseInt(process.env.SERVICE_TIMEOUT_MS || '60000', 10),


};

const requiredConfig = ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'];

requiredConfig.forEach((key) => {
     if (!config[key]) {
          throw new Error(`Missing required environment variable: ${key}`);
     }
});

export {config};