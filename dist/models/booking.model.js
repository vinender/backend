"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
class BookingModel {
    // Create a new booking
    async create(data) {
        const { dogOwnerId, ...rest } = data;
        // Get field data for snapshot
        const field = await database_1.default.field.findUnique({
            where: { id: data.fieldId },
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
        if (!field) {
            throw new Error('Field not found');
        }
        return database_1.default.booking.create({
            data: {
                ...rest,
                userId: dogOwnerId,
                status: 'PENDING',
                // Store field snapshot data for historical accuracy
                fieldName: field.name || '',
                fieldAddress: field.address || '',
                fieldLocation: field.location || null,
                fieldImages: field.images || [],
                fieldPrice: field.price || 0,
                fieldAmenities: field.amenities || [],
                fieldSize: field.size || '',
                fieldType: field.type || '',
                fieldOwnerName: field.owner?.name || '',
                fieldOwnerEmail: field.owner?.email || '',
                fieldRules: field.rules || [],
                bookingDuration: field.bookingDuration || '',
            },
            include: {
                field: {
                    include: {
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });
    }
    // Find booking by ID
    async findById(id) {
        return database_1.default.booking.findUnique({
            where: { id },
            include: {
                field: {
                    include: {
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });
    }
    // Find all bookings with filters
    async findAll(filters = {}) {
        const where = {};
        if (filters.dogOwnerId) {
            where.userId = filters.dogOwnerId;
        }
        if (filters.fieldId) {
            where.fieldId = filters.fieldId;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.date) {
            const startOfDay = new Date(filters.date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(filters.date);
            endOfDay.setHours(23, 59, 59, 999);
            where.date = {
                gte: startOfDay,
                lte: endOfDay,
            };
        }
        if (filters.startDate && filters.endDate) {
            where.date = {
                gte: filters.startDate,
                lte: filters.endDate,
            };
        }
        return database_1.default.booking.findMany({
            where,
            skip: filters.skip,
            take: filters.take,
            orderBy: {
                date: 'desc',
            },
            include: {
                field: {
                    include: {
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });
    }
    // Find bookings by dog owner
    async findByDogOwner(dogOwnerId) {
        return this.findAll({ dogOwnerId });
    }
    // Find bookings by field
    async findByField(fieldId) {
        return this.findAll({ fieldId });
    }
    // Find bookings by field owner
    async findByFieldOwner(ownerId) {
        return database_1.default.booking.findMany({
            where: {
                field: {
                    ownerId,
                },
            },
            orderBy: {
                date: 'desc',
            },
            include: {
                field: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });
    }
    // Update booking status
    async updateStatus(id, status) {
        return database_1.default.booking.update({
            where: { id },
            data: { status },
            include: {
                field: true,
                user: true,
            },
        });
    }
    // Update booking
    async update(id, data) {
        return database_1.default.booking.update({
            where: { id },
            data,
            include: {
                field: true,
                user: true,
            },
        });
    }
    // Cancel booking
    async cancel(id, reason) {
        return database_1.default.booking.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                cancellationReason: reason,
                cancelledAt: new Date(),
            },
            include: {
                field: {
                    include: {
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });
    }
    // Complete booking
    async complete(id) {
        return this.updateStatus(id, 'COMPLETED');
    }
    // Delete booking
    async delete(id) {
        await database_1.default.booking.delete({
            where: { id },
        });
    }
    // Check availability for a field on a specific date and time
    async checkAvailability(fieldId, date, startTime, endTime, excludeBookingId) {
        const where = {
            fieldId,
            date,
            status: {
                notIn: ['CANCELLED', 'COMPLETED'],
            },
        };
        if (excludeBookingId) {
            where.id = {
                not: excludeBookingId,
            };
        }
        const conflictingBookings = await database_1.default.booking.findMany({
            where,
        });
        // Check for time conflicts
        for (const booking of conflictingBookings) {
            const bookingStart = this.timeToMinutes(booking.startTime);
            const bookingEnd = this.timeToMinutes(booking.endTime);
            const requestedStart = this.timeToMinutes(startTime);
            const requestedEnd = this.timeToMinutes(endTime);
            // Check if times overlap
            if ((requestedStart >= bookingStart && requestedStart < bookingEnd) ||
                (requestedEnd > bookingStart && requestedEnd <= bookingEnd) ||
                (requestedStart <= bookingStart && requestedEnd >= bookingEnd)) {
                return false; // Time conflict found
            }
        }
        return true; // No conflicts
    }
    // Helper function to convert time string to minutes
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }
    // Get booking statistics for a field owner
    async getFieldOwnerStats(ownerId) {
        const bookings = await this.findByFieldOwner(ownerId);
        const stats = {
            total: bookings.length,
            pending: bookings.filter(b => b.status === 'PENDING').length,
            confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
            completed: bookings.filter(b => b.status === 'COMPLETED').length,
            cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
            totalRevenue: bookings
                .filter(b => b.status === 'COMPLETED')
                .reduce((sum, b) => sum + b.totalPrice, 0),
        };
        return stats;
    }
    // Get booking statistics for a dog owner
    async getDogOwnerStats(dogOwnerId) {
        const bookings = await this.findByDogOwner(dogOwnerId);
        const stats = {
            total: bookings.length,
            upcoming: bookings.filter(b => b.status === 'CONFIRMED' && new Date(b.date) >= new Date()).length,
            completed: bookings.filter(b => b.status === 'COMPLETED').length,
            cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
            totalSpent: bookings
                .filter(b => b.status === 'COMPLETED')
                .reduce((sum, b) => sum + b.totalPrice, 0),
        };
        return stats;
    }
}
exports.default = new BookingModel();
