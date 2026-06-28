import express from "express";
import initializedContainer from "../dependencies/dependency.js";
import { getUserContext } from "../middlewares/getUserContext.middleware.js";

const router = express.Router();

const {trainController} = initializedContainer.controller;


router.post("/train", getUserContext, (req, res, next) => trainController.createTrain(req, res, next));

router.post("/route", getUserContext, (req, res, next) => trainController.createRoute(req, res, next));

export default router;