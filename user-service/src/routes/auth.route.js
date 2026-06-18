import express from "express";
import initializedContainer from "../dependencies/dependency.js";

const router = express.Router();

const {authController} = initializedContainer.controller;


router.post("/send-otp", (req, res, next) => authController.sendOtp(req, res, next));

router.post("/verify-otp", (req, res, next) => authController.verifyOtp(req, res, next));

router.post("/login", (req, res, next) => authController.login(req, res, next));

router.get("/refresh", (req, res, next) => authController.rotateRefreshToken(req, res, next));


export default router;