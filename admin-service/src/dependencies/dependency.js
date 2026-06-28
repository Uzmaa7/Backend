
import stationRepository from "../repositories/stationRespository.js";
import { StationController } from "../controllers/station.controller.js";
import { StationService } from "../services/station.service.js";
import {TrainService} from "../services/train.service.js";
import {TrainController} from "../controllers/train.controller.js";
import trainRepository from "../repositories/trainRepository.js";
import routeRepository from "../repositories/routeRepository.js";

/**
 * Dependency Injection Container for the admin-service.
 * including repositories, services, and controllers.
 */
class Container {
    static init() {
        // Initialize repositories
        const repositories = {
            stationRepository: stationRepository,
            trainRepository: trainRepository,
            routeRepository: routeRepository,
        };

        // Initialize services with their respective repositories
        const services = {
            stationService: new StationService(repositories.stationRepository),
            trainService: new TrainService(repositories.trainRepository, repositories.routeRepository),
        };

        // Initialize controllers with their respective services
        const controller = {
            stationController: new StationController(services.stationService),
            trainController: new TrainController(services.trainService),
        }

        return {
            repositories, services, controller
        }
    }
}

const initialized = Container.init();
export { Container };
export default initialized