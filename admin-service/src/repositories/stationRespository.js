import CrudRepository from "./CrudRepository.js";
import logger from "../config/logger.js";

class StationRepository extends CrudRepository{
    constructor(){
        super("station");
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
}

export default new StationRepository();