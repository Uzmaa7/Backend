
class BookingRepository extends CrudRepository {
    constructor() {
        super("booking");
    }

    
    async createBookingWithDetails(createData, includeOptions) {
        return await this.model.create({
            data: createData,
            include: includeOptions
        });
    }

    async findBookingWithDetails(id, includeOptions) {
        const response = await this.model.findUnique({
            where: { id },
            include: includeOptions
        });

        if (!response) {
            throw new AppError("Booking not found", StatusCodes.NOT_FOUND);
        }

        return response;
    }


   
}