
import AppError from "./errors/appError.js";
import { config } from "../config/index.js";
import otpGenerator from 'otp-generator';
import crypto from "crypto";
import {redis} from "../config/redis.js";
import { StatusCodes } from "http-status-codes";



const RATE_MAX = parseInt(config.OTP_RATE_MAX_PER_HOUR || "5", 10);
const OTP_TTL = parseInt(config.OTP_TTL || "300", 10);
const HMAC_SECRET = config.OTP_HMAC_SECRET

function hmacFor(email, otp){
    return crypto.createHmac("sha256", HMAC_SECRET).update(email + ":" + otp).digest('hex');
}

async function generateAndStoreOtp(meta) {
    // how many otps you can send in an hour => key = otp:rate:rahul@gmail.com : count
    const rateKey = `otp:rate:${meta.email}`;

    const sentCount = parseInt(await redis.get(rateKey) || "0", 10);

    if(sentCount >= RATE_MAX){
        throw new AppError("Too many OTP requests. Try again later", StatusCodes.TOO_MANY_REQUESTS)
    } 

    //generate otp
    const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
    })

    //generate otp_sessionId
    const otpSessionId= crypto.randomUUID();

    const hashed = hmacFor(meta.email, otp);

    await redis.set(`otp:session:${otpSessionId}`, JSON.stringify({
        hashedOtp: hashed,
        meta
    }), "EX", OTP_TTL)

    await redis.incr(rateKey);
    await redis.expire(rateKey, 3600);
    return {otp, otpSessionId};

}

export {generateAndStoreOtp};