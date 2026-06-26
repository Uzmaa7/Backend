
import stationRepository from "../repositories/stationRespository.js";
import { StationController } from "../controllers/station.controller.js";
import { StationService } from "../services/station.service.js";

/**
 * Dependency Injection Container for the admin-service.
 * including repositories, services, and controllers.
 */
class Container {
    static init() {
        // Initialize repositories
        const repositories = {
            stationRepository: stationRepository
        };

        // Initialize services with their respective repositories
        const services = {
            stationService: new StationService(repositories.stationRepository)
        };

        // Initialize controllers with their respective services
        const controller = {
            stationController: new StationController(services.stationService)
        }

        return {
            repositories, services, controller
        }
    }
}

const initialized = Container.init();
export { Container };
export default initialized