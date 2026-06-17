import BaseRepository from "./BaseRepository.js";
import logger from "../config/logger.js";

class UserRepository extends BaseRepository{
    constructor(){
        super("user");
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

export default new UserRepository();