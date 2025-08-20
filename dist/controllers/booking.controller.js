"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const booking_model_1 = __importDefault(require("../models/booking.model"));
const field_model_1 = __importDefault(require("../models/field.model"));
const asyncHandler_1 = require("../utils/asyncHandler");
const AppError_1 = require("../utils/AppError");
const database_1 = __importDefault(require("../config/database"));
class BookingController {
    // Create a new booking
    createBooking = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const dogOwnerId = req.user.id;
        const { fieldId, date, startTime, endTime, notes } = req.body;
        // Verify field exists and is active
        const field = await field_model_1.default.findById(fieldId);
        if (!field) {
            throw new AppError_1.AppError('Field not found', 404);
        }
        if (!field.isActive) {
            throw new AppError_1.AppError('Field is not available for booking', 400);
        }
        // Check availability
        const isAvailable = await booking_model_1.default.checkAvailability(fieldId, new Date(date), startTime, endTime);
        if (!isAvailable) {
            throw new AppError_1.AppError('This time slot is not available', 400);
        }
        // Calculate total price based on duration
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        const durationHours = (endMinutes - startMinutes) / 60;
        const totalPrice = field.pricePerHour.toNumber() * durationHours;
        // Create booking
        const booking = await booking_model_1.default.create({
            dogOwnerId,
            fieldId,
            date: new Date(date),
            startTime,
            endTime,
            totalPrice,
            notes,
        });
        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: booking,
        });
    });
    // Get all bookings (admin only)
    getAllBookings = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { dogOwnerId, fieldId, status, date, startDate, endDate, page = 1, limit = 10, } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const bookings = await booking_model_1.default.findAll({
            dogOwnerId: dogOwnerId,
            fieldId: fieldId,
            status: status,
            date: date ? new Date(date) : undefined,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            skip,
            take: Number(limit),
        });
        res.json({
            success: true,
            data: bookings,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: bookings.length,
            },
        });
    });
    // Get booking by ID
    getBooking = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            throw new AppError_1.AppError('Booking not found', 404);
        }
        // Check access rights
        const hasAccess = userRole === 'ADMIN' ||
            booking.dogOwnerId === userId ||
            booking.field.ownerId === userId;
        if (!hasAccess) {
            throw new AppError_1.AppError('You do not have access to this booking', 403);
        }
        res.json({
            success: true,
            data: booking,
        });
    });
    // Get user's bookings with pagination
    getMyBookings = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { status, page = 1, limit = 10 } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        let whereClause = {};
        if (userRole === 'DOG_OWNER') {
            whereClause.dogOwnerId = userId;
        }
        else if (userRole === 'FIELD_OWNER') {
            // For field owner, we need to get their field first
            const fields = await database_1.default.field.findMany({
                where: { ownerId: userId },
                select: { id: true },
            });
            if (fields.length === 0) {
                return res.json({
                    success: true,
                    data: [],
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPrevPage: false,
                    },
                });
            }
            whereClause.fieldId = { in: fields.map(f => f.id) };
        }
        else {
            throw new AppError_1.AppError('Invalid user role', 400);
        }
        // Add status filter if provided
        if (status) {
            whereClause.status = status;
        }
        // Get bookings with pagination
        const [bookings, total] = await Promise.all([
            database_1.default.booking.findMany({
                where: whereClause,
                skip,
                take: limitNum,
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
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            database_1.default.booking.count({ where: whereClause }),
        ]);
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            success: true,
            data: bookings,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
            },
        });
    });
    // Update booking status (field owner or admin)
    updateBookingStatus = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            throw new AppError_1.AppError('Booking not found', 404);
        }
        // Check authorization
        const isFieldOwner = booking.field.ownerId === userId;
        const isAdmin = userRole === 'ADMIN';
        if (!isFieldOwner && !isAdmin) {
            throw new AppError_1.AppError('You are not authorized to update this booking', 403);
        }
        // Validate status transition
        const validTransitions = {
            PENDING: ['CONFIRMED', 'CANCELLED'],
            CONFIRMED: ['COMPLETED', 'CANCELLED'],
            COMPLETED: [],
            CANCELLED: [],
        };
        if (!validTransitions[booking.status].includes(status)) {
            throw new AppError_1.AppError(`Cannot change status from ${booking.status} to ${status}`, 400);
        }
        const updatedBooking = await booking_model_1.default.updateStatus(id, status);
        res.json({
            success: true,
            message: `Booking ${status.toLowerCase()} successfully`,
            data: updatedBooking,
        });
    });
    // Cancel booking (dog owner or field owner)
    cancelBooking = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            throw new AppError_1.AppError('Booking not found', 404);
        }
        // Check authorization
        const isDogOwner = booking.dogOwnerId === userId;
        const isFieldOwner = booking.field.ownerId === userId;
        const isAdmin = userRole === 'ADMIN';
        if (!isDogOwner && !isFieldOwner && !isAdmin) {
            throw new AppError_1.AppError('You are not authorized to cancel this booking', 403);
        }
        // Check if booking can be cancelled
        if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
            throw new AppError_1.AppError(`Cannot cancel a ${booking.status.toLowerCase()} booking`, 400);
        }
        // Check cancellation policy (e.g., 24 hours before booking)
        const bookingDate = new Date(booking.date);
        const now = new Date();
        const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilBooking < 24 && !isAdmin) {
            throw new AppError_1.AppError('Bookings can only be cancelled 24 hours in advance', 400);
        }
        const cancelledBooking = await booking_model_1.default.cancel(id);
        res.json({
            success: true,
            message: 'Booking cancelled successfully',
            data: cancelledBooking,
        });
    });
    // Update booking (reschedule)
    updateBooking = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const { date, startTime, endTime, notes } = req.body;
        const userId = req.user.id;
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            throw new AppError_1.AppError('Booking not found', 404);
        }
        // Only dog owner can reschedule their booking
        if (booking.dogOwnerId !== userId) {
            throw new AppError_1.AppError('You can only update your own bookings', 403);
        }
        // Check if booking can be rescheduled
        if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
            throw new AppError_1.AppError('Only pending or confirmed bookings can be rescheduled', 400);
        }
        // If changing time/date, check availability
        if (date || startTime || endTime) {
            const newDate = date ? new Date(date) : booking.date;
            const newStartTime = startTime || booking.startTime;
            const newEndTime = endTime || booking.endTime;
            const isAvailable = await booking_model_1.default.checkAvailability(booking.fieldId, newDate, newStartTime, newEndTime, id // Exclude current booking from check
            );
            if (!isAvailable) {
                throw new AppError_1.AppError('The new time slot is not available', 400);
            }
            // Recalculate price if time changed
            if (startTime || endTime) {
                const field = await field_model_1.default.findById(booking.fieldId);
                const startMinutes = this.timeToMinutes(newStartTime);
                const endMinutes = this.timeToMinutes(newEndTime);
                const durationHours = (endMinutes - startMinutes) / 60;
                const totalPrice = field.pricePerHour.toNumber() * durationHours;
                req.body.totalPrice = totalPrice;
            }
        }
        const updatedBooking = await booking_model_1.default.update(id, req.body);
        res.json({
            success: true,
            message: 'Booking updated successfully',
            data: updatedBooking,
        });
    });
    // Delete booking (admin only)
    deleteBooking = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            throw new AppError_1.AppError('Booking not found', 404);
        }
        await booking_model_1.default.delete(id);
        res.status(204).json({
            success: true,
            message: 'Booking deleted successfully',
        });
    });
    // Get booking statistics
    getBookingStats = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const userRole = req.user.role;
        let stats;
        if (userRole === 'DOG_OWNER') {
            stats = await booking_model_1.default.getDogOwnerStats(userId);
        }
        else if (userRole === 'FIELD_OWNER') {
            stats = await booking_model_1.default.getFieldOwnerStats(userId);
        }
        else {
            throw new AppError_1.AppError('Statistics not available for this user role', 400);
        }
        res.json({
            success: true,
            data: stats,
        });
    });
    // Check field availability
    checkAvailability = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { fieldId, date, startTime, endTime } = req.query;
        if (!fieldId || !date || !startTime || !endTime) {
            throw new AppError_1.AppError('Field ID, date, start time, and end time are required', 400);
        }
        const isAvailable = await booking_model_1.default.checkAvailability(fieldId, new Date(date), startTime, endTime);
        res.json({
            success: true,
            available: isAvailable,
        });
    });
    // Helper function
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }
}
exports.default = new BookingController();
