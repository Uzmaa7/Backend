import express from "express";
import initializedContainer from "../dependencies/dependency.js";

const router = express.Router();

const {authController} = initializedContainer.controller;

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Validate user data and send OTP to email
 * @access  Public
 */
router.post("/send-otp", (req, res, next) => authController.sendOtp(req, res, next));

router.post("/verify-otp", (req, res, next) => authController.verifyOtp(req, res, next));

export default router;