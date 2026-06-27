import express from "express";
import initializedContainer from "../dependencies/dependency.js";
import { getUserContext } from "../middlewares/getUserContext.middleware.js";

const router = express.Router();

const {stationController} = initializedContainer.controller;


router.post("/station", getUserContext, (req, res, next) => stationController.createStation(req, res, next));


export default router;