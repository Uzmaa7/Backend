import { StatusCodes } from "http-status-codes";
import logger from "../config/logger.js";
import AppError from "../utils/errors/appError.js";
import { SuccessResponse, ErrorResponse } from "../utils/common/index.js";
import searchService from "../services/search.service.js";


     export async function searchTrains(req, res, next) {
          try {
               const { from, to, date } = req.query;

               if (!from || !to) {
                    throw new AppError("from and to station names/codes are required", StatusCodes.BAD_REQUEST);
               }

               const results = await searchService.searchTrains(from, to, date || null);

               SuccessResponse.data = results;
               SuccessResponse.message = "Train searched successfully";

               return res
                    .status(StatusCodes.OK)
                    .json(SuccessResponse);

          } catch (error) {
               logger.error("Error inside SearchController [searchTrains]:", error);

               ErrorResponse.error = error;

               const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

               return res
                    .status(statusCode)
                    .json(ErrorResponse)

          }
     }

     export async function autocomplete(req, res, next) {
          try {
               const { q } = req.query;

               if (!q || q.length < 2) {
                    throw new AppError("Provide at least 2 characters", StatusCodes.BAD_REQUEST);
               }

               const suggestions = await searchService.autocompleteStation(q);

               SuccessResponse.data = suggestions;

               return res
                    .status(StatusCodes.OK)
                    .json(SuccessResponse);

          } catch (error) {
               logger.error("Error inside SearchController [autocomplete]:", error);

               ErrorResponse.error = error;
               const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

               return res
                    .status(statusCode)
                    .json(ErrorResponse)

          }
     }
