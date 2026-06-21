import express from "express";
import initializedContainer from "../dependencies/dependency.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const {userController} = initializedContainer.controller;

const router = express.Router();

router.get("/get-profile", verifyJWT, (req, res, next) => userController.getProfile(req, res, next));

export default router;