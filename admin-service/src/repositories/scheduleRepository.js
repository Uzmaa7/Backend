import CrudRepository from "./CrudRepository.js";
import logger from "../config/logger.js";

class ScheduleRepository extends CrudRepository {
    constructor() {
        super("schedule");
    }

    /**
     * Finds a user by their unique email address.
     * Service layer calls: const user = await userRepository.findByEmail(email);
     */
    async findByEmail(email) {

        return await this.model.findUnique({
            where: { email }
        })
    }

    async findExistingSchedule(trainId, departureDate) {
        return await this.model.findUnique({
            where: {
                trainId_departureDate: {
                    trainId: trainId,
                    departureDate: departureDate
                }
            }
        });
    }

    
}

export default new ScheduleRepository();