import dotenv from "dotenv";
import packageJson from "../../package.json" with { type: "json" };

dotenv.config()

const config = {
    SERVICE_NAME: packageJson.name,
    PORT: Number(process.env.PORT) || 4001,
    NODE_ENV: process.env.NODE_ENV || "development",
    LOG_LEVEL: process.env.LOG_LEVEL || "info"

}

export default config;