"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
class FieldModel {
    // Create a new field
    async create(data) {
        // Get owner details if not provided
        let ownerName = data.ownerName;
        let joinedOn = data.joinedOn;
        if ((!ownerName || !joinedOn) && data.ownerId) {
            const owner = await database_1.default.user.findUnique({
                where: { id: data.ownerId },
                select: { name: true, createdAt: true },
            });
            if (owner) {
                ownerName = ownerName || owner.name || undefined;
                // Format joinedOn as "Month Year" if not provided
                if (!joinedOn && owner.createdAt) {
                    const date = new Date(owner.createdAt);
                    const month = date.toLocaleDateString('en-US', { month: 'long' });
                    const year = date.getFullYear();
                    joinedOn = `${month} ${year}`;
                }
            }
        }
        // Remove apartment field as it doesn't exist in the schema
        const { apartment, ...cleanedData } = data;
        return database_1.default.field.create({
            data: {
                ...cleanedData,
                ownerName,
                joinedOn,
                type: cleanedData.type || 'PRIVATE',
                maxDogs: cleanedData.maxDogs || 10,
                instantBooking: cleanedData.instantBooking || false,
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
        const { skip = 0, take = 10, sortBy = 'createdAt', sortOrder = 'desc', ...where } = filters;
        const whereClause = {
            isActive: true,
            isSubmitted: true,
        };
        // Handle comprehensive search (field name, address, city, state, zipCode)
        if (where.search) {
            whereClause.OR = [
                { name: { contains: where.search, mode: 'insensitive' } },
                { description: { contains: where.search, mode: 'insensitive' } },
                { address: { contains: where.search, mode: 'insensitive' } },
                { city: { contains: where.search, mode: 'insensitive' } },
                { state: { contains: where.search, mode: 'insensitive' } },
                { zipCode: { contains: where.search, mode: 'insensitive' } },
            ];
        }
        // Handle specific postal code search
        if (where.zipCode) {
            whereClause.zipCode = where.zipCode;
        }
        // Handle location-based search
        if (where.lat && where.lng) {
            // Simple proximity search (within ~10km radius)
            const radius = 0.09; // ~10km in degrees
            whereClause.latitude = {
                gte: where.lat - radius,
                lte: where.lat + radius,
            };
            whereClause.longitude = {
                gte: where.lng - radius,
                lte: where.lng + radius,
            };
        }
        if (where.city)
            whereClause.city = where.city;
        if (where.state)
            whereClause.state = where.state;
        if (where.type)
            whereClause.type = where.type;
        // Price filter
        if (where.minPrice || where.maxPrice) {
            whereClause.pricePerHour = {};
            if (where.minPrice)
                whereClause.pricePerHour.gte = where.minPrice;
            if (where.maxPrice)
                whereClause.pricePerHour.lte = where.maxPrice;
        }
        // Amenities filter
        if (where.amenities && where.amenities.length > 0) {
            whereClause.amenities = {
                hasEvery: where.amenities,
            };
        }
        // Rating filter
        if (where.minRating) {
            whereClause.averageRating = {
                gte: where.minRating,
            };
        }
        // Number of dogs filter
        if (where.numberOfDogs) {
            whereClause.maxDogs = {
                gte: where.numberOfDogs,
            };
        }
        // Size filter
        if (where.size) {
            whereClause.size = where.size;
        }
        // Terrain type filter
        if (where.terrainType) {
            whereClause.terrainType = where.terrainType;
        }
        // Fence type filter
        if (where.fenceType) {
            whereClause.fenceType = where.fenceType;
        }
        // Instant booking filter
        if (where.instantBooking !== undefined) {
            whereClause.instantBooking = where.instantBooking;
        }
        // Date and time availability filter (basic implementation)
        if (where.date) {
            const dayOfWeek = new Date(where.date).toLocaleDateString('en-US', { weekday: 'long' });
            whereClause.operatingDays = {
                has: dayOfWeek,
            };
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
                orderBy: this.buildOrderBy(sortBy, sortOrder),
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
        // Remove apartment field as it doesn't exist in the schema
        const { apartment, ...dataWithoutApartment } = data;
        // If updating owner, also update owner name and joined date
        let updateData = { ...dataWithoutApartment };
        if (data.ownerId && (!data.ownerName || !data.joinedOn)) {
            const owner = await database_1.default.user.findUnique({
                where: { id: data.ownerId },
                select: { name: true, createdAt: true },
            });
            if (owner) {
                if (!data.ownerName) {
                    updateData.ownerName = owner.name || undefined;
                }
                if (!data.joinedOn && owner.createdAt) {
                    const date = new Date(owner.createdAt);
                    const month = date.toLocaleDateString('en-US', { month: 'long' });
                    const year = date.getFullYear();
                    updateData.joinedOn = `${month} ${year}`;
                }
            }
        }
        return database_1.default.field.update({
            where: { id },
            data: updateData,
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
    // Get field suggestions for autocomplete
    async getSuggestions(query) {
        const whereClause = {
            isActive: true,
            isSubmitted: true,
        };
        // Comprehensive search by field name, address, city, state, or postal code
        whereClause.OR = [
            { name: { contains: query, mode: 'insensitive' } },
            { address: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { state: { contains: query, mode: 'insensitive' } },
            { zipCode: { contains: query, mode: 'insensitive' } },
        ];
        const fields = await database_1.default.field.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                city: true,
                state: true,
                zipCode: true,
                address: true,
                pricePerHour: true,
                averageRating: true,
                totalReviews: true,
                images: true,
            },
            take: 6, // Limit to 6 suggestions
            orderBy: [
                { averageRating: 'desc' },
                { totalReviews: 'desc' },
            ],
        });
        return fields.map(field => ({
            id: field.id,
            name: field.name || 'Unnamed Field',
            address: field.address || '',
            location: `${field.city || ''}${field.city && field.state ? ', ' : ''}${field.state || ''} ${field.zipCode || ''}`.trim(),
            fullAddress: `${field.address || ''}${field.address && (field.city || field.state) ? ', ' : ''}${field.city || ''}${field.city && field.state ? ', ' : ''}${field.state || ''} ${field.zipCode || ''}`.trim(),
            price: field.pricePerHour,
            rating: field.averageRating,
            reviews: field.totalReviews,
            image: field.images?.[0] || null,
        }));
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
    // Helper method to build orderBy clause
    buildOrderBy(sortBy, sortOrder) {
        const orderByOptions = {
            price: { pricePerHour: sortOrder },
            rating: { averageRating: sortOrder },
            reviews: { totalReviews: sortOrder },
            name: { name: sortOrder },
            createdAt: { createdAt: sortOrder },
            distance: { createdAt: sortOrder }, // Would need geospatial calculation
        };
        return orderByOptions[sortBy] || { createdAt: 'desc' };
    }
}
exports.default = new FieldModel();
