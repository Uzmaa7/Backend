import { StatusCodes } from "http-status-codes";
import AppError from "../utils/errors/appError.js";
import logger from "../config/logger.js";


export class StationService{
    constructor(stationRepository) {
        this.stationRepository = stationRepository
    }

    async createStation(data){

        try {
            
            const {name, city, state, code} = data;

            const existingStation =  await this.stationRepository.findOne({code});

            if(existingStation){
                throw new AppError("Station Already Exist", StatusCodes.CONFLICT);
            }

            const station = await this.stationRepository.create(data);

            logger.info("Station created", {id: station.id, code: station.code});


        } catch (error) {
            logger.error("Error inside StaionService [createStation]:", error);

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError("Something went wrong while processing your request on the server", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }
}