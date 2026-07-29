import CrudRepository from "./CrudRepository.js";

class IdempotencyRepository extends CrudRepository {
    constructor() {
        super("idempotencyRecord");
    }

    async findByKey(eventKey) {
        return await this.model.findUnique({
            where: { eventKey }
        });
    }

    async saveKey(eventKey, response) {
        return await this.model.create({
            data: { eventKey, response }
        });
    }
}

export default new IdempotencyRepository();