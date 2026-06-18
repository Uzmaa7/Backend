import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import logger from "../config/logger.js";
import AppError from "./errors/appError.js";
import { StatusCodes } from "http-status-codes";


// . Access Token Generate 
export const generateAccessToken = (userId) => {
    return jwt.sign(
        {
            id: userId
        },
        config.ACCESS_TOKEN_SECRET,
        {
            expiresIn: config.ACCESS_TOKEN_EXP
        });
};

// Refresh Token Generate
export const generateRefreshToken = (userId) => {
    return jwt.sign(
        {
            id: userId,
            jti: crypto.randomUUID()
        },
        config.REFRESH_TOKEN_SECRET,
        {
            expiresIn: config.REFRESH_TOKEN_EXP
        });
};


// verfiy Refresh Token
export const verifyRefreshToken = (refreshToken) => {

    return jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);

};

// Refresh Token ko database me save karne se pehle hash karna (Security ke liye)
export const hashToken = (refreshToken) => {
    if (!refreshToken) return null;
    return crypto.createHash("sha256").update(refreshToken).digest("hex");
};