import CrudRepository from "./CrudRepository.js";
import logger from "../config/logger.js";

class RouteRepository extends CrudRepository{
    constructor(){
        super("route");
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

    async createRouteWithStations(createData, includeOptions) {
        return await this.model.create({
            data: createData,
            include: includeOptions
        });
    }

   
}

export default new RouteRepository();