import logger from "../config/logger.js";
import prisma from "../config/prisma.js";
import AppError from "../utils/errors/appError.js";
import {StatusCodes} from "http-status-codes";


export default class BaseRepository {
    constructor(model){
        this.model = prisma[model];
    }
    /**
     * 1. Create a new record
     */
    async create(data){
       
            const response = await this.model.create({data});
            return response;
       
    }


    /**
     * 2. Find a single record by its Unique ID
     */
    async findById(id){
       
            const response = await this.model.findUnique({
                where:  {id}
            })

            if(!response){
                throw new AppError("Not able to find the resource", StatusCodes.NOT_FOUND)
            }
            return response;
      
           
        
    }

    /**
     * Strict Unique Find (Sirf @id ya @unique fields ke liye)
     * Usage: this.findUnique({ email: "abc@gmail.com" })
     */
    async findUnique(whereCondition) {
       
            return await this.model.findUnique({
                where: whereCondition
            });
       
        
    }

    /**
     * Flexible Find (Kisi bhi normal field ke liye jo unique na ho)
     * Usage: this.findOne({ firstName: "Rahul" }) ya { role: "admin" }
     */
    async findOne(whereCondition) {
      
            return await this.model.findFirst({
                where: whereCondition
            });
      
      
    }

    /**
     * 4. Get all records (with optional filtering)
     * Usage: this.findAll({ isActive: true }) ya bina arguments ke saara data
     */
    async findAll(whereCondition = {}) {
     
            return await this.model.findMany({
                where: whereCondition
            });
   
            logger.error(`Error in BaseRepository [findAll]:`, error);
            throw error;
        
    }

    /**
     * 5. Update a record by ID
     */
    async update(id, updateData) {
      
            return await this.model.update({
                where: { id },
                data: updateData
            });
      
    }

    /**
     * 6. Delete a record by ID (Hard Delete)
     */
    async delete(id) {
     
            return await this.model.delete({
                where: { id }
            });
       
    }
}