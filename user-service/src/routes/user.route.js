import express from "express";
import initializedContainer from "../dependencies/dependency.js";
// import { verifyJWT } from "../middlewares/auth.middleware.js";
import {getUserContext} from "../middlewares/getUserContext.middleware.js";

const {userController} = initializedContainer.controller;

const router = express.Router();

router.get("/get-profile", getUserContext, (req, res, next) => userController.getProfile(req, res, next));

export default router;