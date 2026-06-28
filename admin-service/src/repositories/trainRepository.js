import CrudRepository from "./CrudRepository.js";
import logger from "../config/logger.js";

class TrainRepository extends CrudRepository{
    constructor(){
        super("train");
    }

    /**
     * Finds a user by their unique email address.
     * Service layer calls: const user = await userRepository.findByEmail(email);
     */
    async findByEmail(email){
      
            return await this.model.findUnique({
                where:  {email}
            })
    }

    async createTrainWithSeats(createData, includeOptions) {
        return await this.model.create({
            data: createData,
            include: includeOptions
        });
    }
}

export default new TrainRepository();