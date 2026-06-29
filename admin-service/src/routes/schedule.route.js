
import express from "express";
import initializedContainer from "../dependencies/dependency.js";
import { getUserContext } from "../middlewares/getUserContext.middleware.js";

const router = express.Router();

const {scheduleController} = initializedContainer.controller;

router.post("/schedule", getUserContext, (req, res, next) => scheduleController.createSchedule(req, res, next));

export default router;