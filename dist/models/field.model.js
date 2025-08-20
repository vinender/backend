"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
class FieldModel {
    // Create a new field
    async create(data) {
        return database_1.default.field.create({
            data: {
                ...data,
                country: data.country || 'UK',
                type: data.type || 'PRIVATE',
                maxDogs: data.maxDogs || 10,
                instantBooking: data.instantBooking || false,
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }
    // Find field by ID
    async findById(id) {
        return database_1.default.field.findUnique({
            where: { id },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                reviews: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                image: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        bookings: true,
                        reviews: true,
                        favorites: true,
                    },
                },
            },
        });
    }
    // Find all fields with filters and pagination
    async findAll(filters) {
        const { skip = 0, take = 10, ...where } = filters;
        const whereClause = {
            isActive: true,
        };
        if (where.city)
            whereClause.city = where.city;
        if (where.state)
            whereClause.state = where.state;
        if (where.type)
            whereClause.type = where.type;
        if (where.minPrice || where.maxPrice) {
            whereClause.pricePerHour = {};
            if (where.minPrice)
                whereClause.pricePerHour.gte = where.minPrice;
            if (where.maxPrice)
                whereClause.pricePerHour.lte = where.maxPrice;
        }
        // Get total count for pagination
        const [fields, total] = await Promise.all([
            database_1.default.field.findMany({
                where: whereClause,
                skip,
                take,
                include: {
                    owner: {
                        select: {
                            name: true,
                            image: true,
                        },
                    },
                    _count: {
                        select: {
                            bookings: true,
                            reviews: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            database_1.default.field.count({ where: whereClause }),
        ]);
        return {
            fields,
            total,
            hasMore: skip + take < total,
        };
    }
    // Find all fields with filters (legacy - for backward compatibility)
    async findAllLegacy(filters) {
        const { skip = 0, take = 10, ...where } = filters;
        const whereClause = {
            isActive: true,
        };
        if (where.city)
            whereClause.city = where.city;
        if (where.state)
            whereClause.state = where.state;
        if (where.type)
            whereClause.type = where.type;
        if (where.minPrice || where.maxPrice) {
            whereClause.pricePerHour = {};
            if (where.minPrice)
                whereClause.pricePerHour.gte = where.minPrice;
            if (where.maxPrice)
                whereClause.pricePerHour.lte = where.maxPrice;
        }
        return database_1.default.field.findMany({
            where: whereClause,
            skip,
            take,
            include: {
                owner: {
                    select: {
                        name: true,
                        image: true,
                    },
                },
                _count: {
                    select: {
                        bookings: true,
                        reviews: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    // Find fields by owner
    async findByOwner(ownerId) {
        return database_1.default.field.findMany({
            where: { ownerId },
            include: {
                _count: {
                    select: {
                        bookings: true,
                        reviews: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    // Find single field by owner (for field owners who have one field)
    async findOneByOwner(ownerId) {
        return database_1.default.field.findFirst({
            where: { ownerId },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                _count: {
                    select: {
                        bookings: true,
                        reviews: true,
                    },
                },
            },
        });
    }
    // Update field
    async update(id, data) {
        return database_1.default.field.update({
            where: { id },
            data,
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }
    // Update field step completion
    async updateStepCompletion(id, step, completed = true) {
        const stepField = `${step}Completed`;
        return database_1.default.field.update({
            where: { id },
            data: {
                [stepField]: completed,
            },
        });
    }
    // Submit field for review
    async submitField(id) {
        return database_1.default.field.update({
            where: { id },
            data: {
                isSubmitted: true,
                submittedAt: new Date(),
                isActive: true, // Activate field on submission
            },
        });
    }
    // Delete field
    async delete(id) {
        return database_1.default.field.delete({
            where: { id },
        });
    }
    // Toggle field active status
    async toggleActive(id) {
        const field = await database_1.default.field.findUnique({
            where: { id },
            select: { isActive: true },
        });
        return database_1.default.field.update({
            where: { id },
            data: { isActive: !field?.isActive },
        });
    }
    // Search fields by location
    async searchByLocation(lat, lng, radius = 10) {
        // This is a simplified version. In production, you'd use PostGIS or similar
        // for proper geospatial queries
        return database_1.default.field.findMany({
            where: {
                isActive: true,
                latitude: {
                    gte: lat - radius / 111, // rough conversion: 1 degree ≈ 111 km
                    lte: lat + radius / 111,
                },
                longitude: {
                    gte: lng - radius / 111,
                    lte: lng + radius / 111,
                },
            },
            include: {
                owner: {
                    select: {
                        name: true,
                        image: true,
                    },
                },
                _count: {
                    select: {
                        bookings: true,
                        reviews: true,
                    },
                },
            },
        });
    }
}
exports.default = new FieldModel();
