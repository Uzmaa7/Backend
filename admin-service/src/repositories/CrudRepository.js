import logger from "../config/logger.js";
import prisma from "../config/prisma.js";
import AppError from "../utils/errors/appError.js";
import { StatusCodes } from "http-status-codes";


export default class CrudRepository {
    constructor(model) {
        this.model = prisma[model];
    }
    /**
     * 1. Create a new record
     * return {}
     */
    async create(data) {

        const response = await this.model.create({ data });
        return response;

    }

    /**
     * return deleted object: {}
     * if resource dont find: throw error
     */

    async delete(id) {
        try {
            const response = await this.model.delete({
                where: {
                    id: id // Agar id String (UUID) hai toh direct pass hogi, agar Int hai toh parse karna pad sakta hai
                }
            });
            return response;
        } catch (error) {
            
            if (error.code === 'P2025') {
                throw new AppError('The resource you are trying to delete does not exist', StatusCodes.NOT_FOUND);
            }
            throw error;
        }

    }


    /**
     * 2. Find a single record by its Unique ID
     * return {}
     * if not found : return null
     */
    async findById(id) {// 👈 id = "123-uuid-456"

        const response = await this.model.findUnique({
            where: { id }// 👈 "123-uuid-456"
        })

        if (!response) {
            throw new AppError("The requested resource was not found", StatusCodes.NOT_FOUND);
        }
        return response;

    }

    /**
     * Jab aapko database se ek se zyada records chahiye jo kisi condition ko match karein 
     * (jaise ek hi city ke saare stations).
     * Mongoose: User.find({ city })
     * Prisma: findMany({ where: { city } })
     * return [{}, {}]
     * if not found []
     */
    async find(whereCondition = {}) {

        return await this.model.findMany({
            where: whereCondition
        });

        

    }

    /**
     * Jab aapko pata hai ki aap jis field se dhundh rahe hain,
     *  vo pure database mein unique hai aur usse sirf ek hi record milega.
     * Mongoose: User.findOne({ email }) use karte hain.
     * Prisma: findUnique({ where: { email } })
     * return {}
     * if not found null
     */
    async findOne(whereCondition) {// 👈 { trainNumber: "12301" }

        // logger.info("inside crudRepo: ", whereCondition);

        return await this.model.findUnique({
            where: whereCondition // 👈 { trainNumber: "12301" }
        });


    }

    /**
     * return updated object{}
     * if not found throw error
     */
    async update(id, updateData) {

        try {
            const response = await this.model.update({
            where: { id },
            data: updateData
        });

        return response;
        } catch (error) {
            if (error.code === 'P2025') {
                throw new AppError('The resource you are trying to update does not exist', StatusCodes.NOT_FOUND);
            }
            throw error;
        }

    }


}