import AppError from "../utils/errors/appError.js";
import {StatusCodes} from "http-status-codes";
import { SuccessResponse, ErrorResponse } from "../utils/common/index.js";
import logger from "../config/logger.js";


export class StationController{

    constructor(stationService){
        if (!stationService) {
            throw new Error("StationService is required for StationController");
        }

        this.stationService = stationService;
    }


    async createStation (req, res, next) {
        try {

            const {name, city, state, code} = req.body;

            if(!name || !city || !state || !code){
                throw new AppError("Name, City, State and Code is required", StatusCodes.BAD_REQUEST);
            }

            const station = await this.stationService.createStation({
                name,
                city,
                state,
                code: code.toUpperCase(),
            });

            SuccessResponse.data = station;
            SuccessResponse.message = "Station created Successfully";

            res
            .status(StatusCodes.CREATED)
            .json(SuccessResponse)
            
        } catch (error) {
            logger.error("Error in StationController [createStation] : ", error);
            
            ErrorResponse.error = error;

            return res
                .status(error.statusCode)
                .json(ErrorResponse)
        }
    }
}