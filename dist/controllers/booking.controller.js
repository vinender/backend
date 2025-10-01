"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const booking_model_1 = __importDefault(require("../models/booking.model"));
const field_model_1 = __importDefault(require("../models/field.model"));
const asyncHandler_1 = require("../utils/asyncHandler");
const AppError_1 = require("../utils/AppError");
const database_1 = __importDefault(require("../config/database"));
const notification_controller_1 = require("./notification.controller");
const payout_service_1 = require("../services/payout.service");
const refund_service_1 = __importDefault(require("../services/refund.service"));
const email_service_1 = require("../services/email.service");
class BookingController {
    // Create a new booking
    createBooking = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const dogOwnerId = req.user.id;
        const { fieldId, date, startTime, endTime, notes, numberOfDogs = 1 } = req.body;
        // Check if user is blocked
        const user = await database_1.default.user.findUnique({
            where: { id: dogOwnerId },
            select: { isBlocked: true, blockReason: true }
        });
        if (user?.isBlocked) {
            throw new AppError_1.AppError(`Your account has been blocked. ${user.blockReason || 'Please contact support for more information'}`, 403);
        }
        // Verify field exists and is active
        const field = await field_model_1.default.findById(fieldId);
        if (!field) {
            throw new AppError_1.AppError('Field not found', 404);
        }
        if (!field.isActive) {
            throw new AppError_1.AppError('Field is not available for booking', 400);
        }
        // Check if the time slot is in the past
        const bookingDate = new Date(date);
        const [startHourStr, startPeriod] = startTime.split(/(?=[AP]M)/);
        let startHour = parseInt(startHourStr.split(':')[0]);
        if (startPeriod === 'PM' && startHour !== 12)
            startHour += 12;
        if (startPeriod === 'AM' && startHour === 12)
            startHour = 0;
        const slotDateTime = new Date(bookingDate);
        slotDateTime.setHours(startHour, parseInt(startHourStr.split(':')[1] || '0'), 0, 0);
        if (slotDateTime < new Date()) {
            throw new AppError_1.AppError('Cannot book a time slot in the past', 400);
        }
        // Check if slot is already booked (private booking system)
        const startOfDayDate = new Date(bookingDate);
        startOfDayDate.setHours(0, 0, 0, 0);
        const endOfDayDate = new Date(bookingDate);
        endOfDayDate.setHours(23, 59, 59, 999);
        const existingBooking = await database_1.default.booking.findFirst({
            where: {
                fieldId,
                date: {
                    gte: startOfDayDate,
                    lte: endOfDayDate
                },
                startTime,
                status: {
                    notIn: ['CANCELLED']
                }
            }
        });
        if (existingBooking) {
            throw new AppError_1.AppError('This time slot is already booked. Once booked, a slot becomes private for that dog owner.', 400);
        }
        // Check availability
        const isAvailable = await booking_model_1.default.checkAvailability(fieldId, new Date(date), startTime, endTime);
        if (!isAvailable) {
            throw new AppError_1.AppError('This time slot is not available', 400);
        }
        // Calculate total price based on duration and number of dogs
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        const durationHours = (endMinutes - startMinutes) / 60;
        const pricePerUnit = field.price || 0;
        let totalPrice = 0;
        if (field.bookingDuration === '30min') {
            // For 30-minute slots, the price is per 30 minutes
            const duration30MinBlocks = durationHours * 2; // Convert hours to 30-min blocks
            totalPrice = pricePerUnit * duration30MinBlocks * numberOfDogs;
        }
        else {
            // For hourly slots, price is per hour
            totalPrice = pricePerUnit * durationHours * numberOfDogs;
        }
        // Log for debugging
        console.log('Create booking price calculation:', {
            fieldId: field.id,
            pricePerUnit,
            durationHours,
            numberOfDogs,
            bookingDuration: field.bookingDuration,
            totalPrice
        });
        // Calculate commission amounts using dynamic commission rate
        const { calculatePayoutAmounts } = await Promise.resolve().then(() => __importStar(require('../utils/commission.utils')));
        const { fieldOwnerAmount, platformCommission } = await calculatePayoutAmounts(totalPrice, field.ownerId || '');
        // Create booking
        const booking = await booking_model_1.default.create({
            dogOwnerId,
            fieldId,
            date: new Date(date),
            startTime,
            endTime,
            timeSlot: `${startTime} - ${endTime}`, // Set timeSlot to match startTime and endTime
            totalPrice,
            fieldOwnerAmount,
            platformCommission,
            numberOfDogs, // Store for pricing and info, but slot is now private
            notes,
        });
        // Send notification to field owner (if not booking their own field)
        console.log('=== Booking Notification Debug ===');
        console.log('Field owner ID:', field.ownerId);
        console.log('Dog owner ID:', dogOwnerId);
        console.log('Are they the same?', field.ownerId === dogOwnerId);
        if (field.ownerId && field.ownerId !== dogOwnerId) {
            console.log('Sending notification to field owner...');
            try {
                await (0, notification_controller_1.createNotification)({
                    userId: field.ownerId,
                    type: 'new_booking_received',
                    title: 'New Booking Received!',
                    message: `You have a new booking request for ${field.name} on ${new Date(date).toLocaleDateString()} from ${startTime} to ${endTime}. Please review and confirm.`,
                    data: {
                        bookingId: booking.id,
                        fieldId: field.id,
                        fieldName: field.name,
                        date,
                        startTime,
                        endTime,
                        dogOwnerName: req.user.name,
                    },
                });
                console.log('Field owner notification sent successfully');
            }
            catch (error) {
                console.error('Failed to send field owner notification:', error);
            }
        }
        else {
            console.log('Skipping field owner notification - booking own field');
        }
        // Send confirmation notification to dog owner
        console.log('Sending confirmation notification to dog owner...');
        try {
            await (0, notification_controller_1.createNotification)({
                userId: dogOwnerId,
                type: 'booking_request_sent',
                title: 'Booking Request Sent',
                message: `Your booking request for ${field.name} on ${new Date(date).toLocaleDateString()} has been sent to the field owner. You'll be notified once it's confirmed.`,
                data: {
                    bookingId: booking.id,
                    fieldId: field.id,
                    fieldName: field.name,
                    date,
                    startTime,
                    endTime,
                    totalPrice,
                },
            });
            console.log('Dog owner confirmation notification sent successfully');
        }
        catch (error) {
            console.error('Failed to send dog owner notification:', error);
        }
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
            booking.userId === userId ||
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
        const { status, page = 1, limit = 10, includeExpired, includeFuture } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        let whereClause = {};
        if (userRole === 'DOG_OWNER') {
            whereClause.userId = userId;
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
        // Handle multiple statuses and date filtering
        if (status) {
            const statuses = status.split(',');
            // If multiple statuses, use OR condition
            if (statuses.length > 1) {
                const statusConditions = [];
                const now = new Date();
                for (const s of statuses) {
                    const statusCondition = { status: s };
                    // For CANCELLED bookings, filter by date
                    if (s === 'CANCELLED') {
                        if (includeFuture === 'true') {
                            // Upcoming tab: show cancelled bookings with future dates
                            statusCondition.date = { gte: now };
                        }
                        else if (includeExpired === 'true') {
                            // Previous tab: show cancelled bookings with past dates
                            statusCondition.date = { lt: now };
                        }
                    }
                    statusConditions.push(statusCondition);
                }
                // For non-cancelled statuses, don't apply date filter
                const nonCancelledStatuses = statuses.filter(s => s !== 'CANCELLED');
                if (nonCancelledStatuses.length > 0) {
                    whereClause.OR = [
                        { status: { in: nonCancelledStatuses } },
                        ...statusConditions.filter(sc => sc.status === 'CANCELLED')
                    ];
                }
                else {
                    whereClause.OR = statusConditions;
                }
            }
            else {
                whereClause.status = status;
            }
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
        // Automatically mark past CONFIRMED bookings as COMPLETED
        const now = new Date();
        const processedBookings = bookings.map((booking) => {
            // Check if booking is past and still CONFIRMED
            if (booking.status === 'CONFIRMED' && new Date(booking.date) < now) {
                // Parse the booking end time to check if the session has ended
                const bookingDate = new Date(booking.date);
                const [endHourStr, endPeriod] = booking.endTime.split(/(?=[AP]M)/);
                let endHour = parseInt(endHourStr.split(':')[0]);
                const endMinute = parseInt(endHourStr.split(':')[1] || '0');
                if (endPeriod === 'PM' && endHour !== 12)
                    endHour += 12;
                if (endPeriod === 'AM' && endHour === 12)
                    endHour = 0;
                bookingDate.setHours(endHour, endMinute, 0, 0);
                // If the booking end time has passed, treat it as completed
                if (bookingDate < now) {
                    return { ...booking, status: 'COMPLETED' };
                }
            }
            return booking;
        });
        res.json({
            success: true,
            data: processedBookings,
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
        // Send notifications based on status change
        const field = booking.field;
        if (status === 'CONFIRMED') {
            // Notify dog owner that booking is confirmed
            await (0, notification_controller_1.createNotification)({
                userId: booking.userId,
                type: 'booking_confirmed',
                title: 'Booking Confirmed!',
                message: `Your booking for ${field.name} on ${new Date(booking.date).toLocaleDateString()} has been confirmed by the field owner.`,
                data: {
                    bookingId: booking.id,
                    fieldId: field.id,
                    fieldName: field.name,
                    date: booking.date,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                },
            });
            // Send email notification
            try {
                const dogOwner = await database_1.default.user.findUnique({
                    where: { id: booking.userId },
                    select: { email: true, name: true }
                });
                if (dogOwner?.email) {
                    await email_service_1.emailService.sendBookingStatusChangeEmail({
                        email: dogOwner.email,
                        userName: dogOwner.name || 'Valued Customer',
                        bookingId: booking.id,
                        fieldName: field.name,
                        date: new Date(booking.date),
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        newStatus: 'CONFIRMED'
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending confirmation email:', emailError);
            }
        }
        else if (status === 'COMPLETED') {
            // Notify dog owner that booking is completed
            await (0, notification_controller_1.createNotification)({
                userId: booking.userId,
                type: 'booking_completed',
                title: 'Booking Completed',
                message: `We hope you enjoyed your visit to ${field.name}. Consider leaving a review!`,
                data: {
                    bookingId: booking.id,
                    fieldId: field.id,
                    fieldName: field.name,
                },
            });
            // Send email notification
            try {
                const dogOwner = await database_1.default.user.findUnique({
                    where: { id: booking.userId },
                    select: { email: true, name: true }
                });
                if (dogOwner?.email) {
                    await email_service_1.emailService.sendBookingStatusChangeEmail({
                        email: dogOwner.email,
                        userName: dogOwner.name || 'Valued Customer',
                        bookingId: booking.id,
                        fieldName: field.name,
                        date: new Date(booking.date),
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        newStatus: 'COMPLETED'
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending completion email:', emailError);
            }
            // Trigger automatic payout to field owner
            try {
                console.log(`Triggering automatic payout for completed booking ${id}`);
                await payout_service_1.payoutService.processBookingPayout(id);
                console.log(`Payout processed successfully for booking ${id}`);
            }
            catch (payoutError) {
                console.error(`Failed to process payout for booking ${id}:`, payoutError);
                // Don't throw error - payout can be retried later
                // Notify admin about the failed payout
                const adminUsers = await database_1.default.user.findMany({
                    where: { role: 'ADMIN' }
                });
                for (const admin of adminUsers) {
                    await (0, notification_controller_1.createNotification)({
                        userId: admin.id,
                        type: 'PAYOUT_FAILED',
                        title: 'Automatic Payout Failed',
                        message: `Failed to process automatic payout for booking ${id}`,
                        data: {
                            bookingId: id,
                            error: payoutError instanceof Error ? payoutError.message : 'Unknown error'
                        }
                    });
                }
            }
        }
        res.json({
            success: true,
            message: `Booking ${status.toLowerCase()} successfully`,
            data: updatedBooking,
        });
    });
    // Mark past bookings as completed (can be called by a cron job)
    markPastBookingsAsCompleted = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const now = new Date();
        // Find all bookings that are past their date/time and not already completed or cancelled
        const completedBookings = await database_1.default.booking.updateMany({
            where: {
                status: {
                    notIn: ['COMPLETED', 'CANCELLED'],
                },
                date: {
                    lt: now,
                },
            },
            data: {
                status: 'COMPLETED',
            },
        });
        res.json({
            success: true,
            message: `Marked ${completedBookings.count} bookings as completed`,
            data: {
                count: completedBookings.count,
            },
        });
    });
    // Check refund eligibility for a booking
    checkRefundEligibility = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        // Get cancellation window from settings
        const settings = await database_1.default.systemSettings.findFirst();
        const cancellationWindowHours = settings?.cancellationWindowHours || 24;
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            throw new AppError_1.AppError('Booking not found', 404);
        }
        // Check authorization
        const isDogOwner = booking.userId === userId;
        if (!isDogOwner) {
            throw new AppError_1.AppError('You are not authorized to check this booking', 403);
        }
        // Calculate time until booking from current time
        const now = new Date();
        const bookingDate = new Date(booking.date);
        // Parse the booking start time to add to the date
        const [startHourStr, startPeriod] = booking.startTime.split(/(?=[AP]M)/);
        let startHour = parseInt(startHourStr.split(':')[0]);
        const startMinute = parseInt(startHourStr.split(':')[1] || '0');
        if (startPeriod === 'PM' && startHour !== 12)
            startHour += 12;
        if (startPeriod === 'AM' && startHour === 12)
            startHour = 0;
        bookingDate.setHours(startHour, startMinute, 0, 0);
        // Debug logging
        console.log('=== Refund Eligibility Check ===');
        console.log('Booking ID:', booking.id);
        console.log('Current time:', now.toISOString());
        console.log('Booking date/time:', bookingDate.toISOString());
        console.log('Start time:', booking.startTime);
        // Calculate hours until booking from now
        const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        const isRefundEligible = hoursUntilBooking >= cancellationWindowHours;
        console.log('Hours until booking:', hoursUntilBooking);
        console.log('Is refund eligible:', isRefundEligible);
        console.log('=========================');
        res.json({
            success: true,
            data: {
                isRefundEligible,
                hoursUntilBooking: Math.floor(hoursUntilBooking),
                canCancel: hoursUntilBooking >= cancellationWindowHours,
                message: isRefundEligible
                    ? `This booking can be cancelled with a full refund. There are ${Math.floor(hoursUntilBooking)} hours until the booking time.`
                    : `This booking cannot be cancelled with a refund. Cancellations must be made at least ${cancellationWindowHours} hours before the booking time. Only ${Math.floor(hoursUntilBooking)} hours remain.`,
            },
        });
    });
    // Cancel booking (dog owner or field owner)
    cancelBooking = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        const { reason } = req.body;
        // Get cancellation window from settings
        const settings = await database_1.default.systemSettings.findFirst();
        const cancellationWindowHours = settings?.cancellationWindowHours || 24;
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            throw new AppError_1.AppError('Booking not found', 404);
        }
        // Check authorization
        const isDogOwner = booking.userId === userId;
        const isFieldOwner = booking.field.ownerId === userId;
        const isAdmin = userRole === 'ADMIN';
        if (!isDogOwner && !isFieldOwner && !isAdmin) {
            throw new AppError_1.AppError('You are not authorized to cancel this booking', 403);
        }
        // Check if booking can be cancelled
        if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
            throw new AppError_1.AppError(`Cannot cancel a ${booking.status.toLowerCase()} booking`, 400);
        }
        // Calculate time until booking from current time
        const now = new Date();
        const bookingDate = new Date(booking.date);
        // Parse the booking start time to add to the date
        const [startHourStr, startPeriod] = booking.startTime.split(/(?=[AP]M)/);
        let startHour = parseInt(startHourStr.split(':')[0]);
        const startMinute = parseInt(startHourStr.split(':')[1] || '0');
        if (startPeriod === 'PM' && startHour !== 12)
            startHour += 12;
        if (startPeriod === 'AM' && startHour === 12)
            startHour = 0;
        bookingDate.setHours(startHour, startMinute, 0, 0);
        // Debug logging for cancellation
        console.log('=== Cancel Booking Check ===');
        console.log('Booking ID:', booking.id);
        console.log('Current time:', now.toISOString());
        console.log('Booking date/time:', bookingDate.toISOString());
        console.log('Start time:', booking.startTime);
        // Calculate hours until booking from now
        const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        // Check if cancellation is allowed (at least cancellationWindowHours before booking)
        if (hoursUntilBooking < cancellationWindowHours && !isAdmin) {
            throw new AppError_1.AppError(`Cancellation not allowed. Bookings must be cancelled at least ${cancellationWindowHours} hours in advance.`, 400);
        }
        // Refund is eligible if cancelled at least 24 hours before booking
        const isRefundEligible = hoursUntilBooking >= cancellationWindowHours;
        console.log('Hours until booking:', hoursUntilBooking);
        console.log('Is refund eligible:', isRefundEligible);
        console.log('===================================');
        const cancelledBooking = await booking_model_1.default.cancel(id, reason);
        // Process immediate refund if eligible
        let refundResult = null;
        if (isRefundEligible && isDogOwner) {
            try {
                refundResult = await refund_service_1.default.processRefund(id, reason);
            }
            catch (refundError) {
                console.error('Refund processing error:', refundError);
                // Continue with cancellation even if refund fails
            }
        }
        else if (!isRefundEligible && isDogOwner) {
            // If not eligible for refund, transfer full amount to field owner after cancellation period
            try {
                await refund_service_1.default.processFieldOwnerPayout(booking, 0);
            }
            catch (payoutError) {
                console.error('Payout processing error:', payoutError);
            }
        }
        // Send cancellation notifications
        const field = booking.field;
        if (isDogOwner) {
            // Dog owner cancelled - notify field owner
            if (field.ownerId) {
                await (0, notification_controller_1.createNotification)({
                    userId: field.ownerId,
                    type: 'booking_cancelled_by_customer',
                    title: 'Booking Cancelled',
                    message: `A booking for ${field.name} on ${new Date(booking.date).toLocaleDateString()} has been cancelled by the customer.`,
                    data: {
                        bookingId: booking.id,
                        fieldId: field.id,
                        fieldName: field.name,
                        date: booking.date,
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                    },
                });
                // Send email to field owner
                try {
                    const fieldOwner = await database_1.default.user.findUnique({
                        where: { id: field.ownerId },
                        select: { email: true, name: true }
                    });
                    if (fieldOwner?.email) {
                        const dogOwner = await database_1.default.user.findUnique({
                            where: { id: booking.userId },
                            select: { name: true, email: true }
                        });
                        await email_service_1.emailService.sendBookingStatusChangeEmail({
                            email: fieldOwner.email,
                            userName: fieldOwner.name || 'Field Owner',
                            bookingId: booking.id,
                            fieldName: field.name,
                            date: new Date(booking.date),
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            newStatus: 'CANCELLED',
                            reason: `Cancelled by customer: ${dogOwner?.name || dogOwner?.email || 'Customer'}. ${reason || ''}`
                        });
                    }
                }
                catch (emailError) {
                    console.error('Error sending cancellation email to field owner:', emailError);
                }
            }
            // Send confirmation to dog owner
            await (0, notification_controller_1.createNotification)({
                userId: booking.userId,
                type: 'booking_cancelled_success',
                title: 'Booking Cancelled',
                message: `Your booking for ${field.name} on ${new Date(booking.date).toLocaleDateString()} has been cancelled successfully.`,
                data: {
                    bookingId: booking.id,
                    fieldId: field.id,
                    fieldName: field.name,
                },
            });
            // Send email to dog owner
            try {
                const dogOwner = await database_1.default.user.findUnique({
                    where: { id: booking.userId },
                    select: { email: true, name: true }
                });
                if (dogOwner?.email) {
                    await email_service_1.emailService.sendBookingStatusChangeEmail({
                        email: dogOwner.email,
                        userName: dogOwner.name || 'Valued Customer',
                        bookingId: booking.id,
                        fieldName: field.name,
                        date: new Date(booking.date),
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        newStatus: 'CANCELLED',
                        reason: reason || 'You cancelled this booking'
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending cancellation confirmation email:', emailError);
            }
        }
        else if (isFieldOwner) {
            // Field owner cancelled - notify dog owner
            await (0, notification_controller_1.createNotification)({
                userId: booking.userId,
                type: 'booking_cancelled_by_owner',
                title: 'Booking Cancelled by Field Owner',
                message: `Unfortunately, your booking for ${field.name} on ${new Date(booking.date).toLocaleDateString()} has been cancelled by the field owner.`,
                data: {
                    bookingId: booking.id,
                    fieldId: field.id,
                    fieldName: field.name,
                    date: booking.date,
                },
            });
            // Send email to dog owner
            try {
                const dogOwner = await database_1.default.user.findUnique({
                    where: { id: booking.userId },
                    select: { email: true, name: true }
                });
                if (dogOwner?.email) {
                    await email_service_1.emailService.sendBookingStatusChangeEmail({
                        email: dogOwner.email,
                        userName: dogOwner.name || 'Valued Customer',
                        bookingId: booking.id,
                        fieldName: field.name,
                        date: new Date(booking.date),
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        newStatus: 'CANCELLED',
                        reason: reason || 'The field owner cancelled this booking'
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending cancellation email to dog owner:', emailError);
            }
        }
        res.json({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
                ...cancelledBooking,
                isRefundEligible,
                refundResult,
                refundMessage: refundResult?.success
                    ? `Refund of €${refundResult.refundAmount?.toFixed(2) || '0.00'} has been initiated and will be credited to your account within 5-7 business days.`
                    : isRefundEligible
                        ? 'You are eligible for a refund. The amount will be credited to your account within 5-7 business days.'
                        : `This booking is not eligible for a refund as it was cancelled less than ${cancellationWindowHours} hours before the scheduled time.`,
            },
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
        if (booking.userId !== userId) {
            throw new AppError_1.AppError('You can only update your own bookings', 403);
        }
        // Check if booking can be rescheduled
        if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
            throw new AppError_1.AppError('Only pending or confirmed bookings can be rescheduled', 400);
        }
        // If changing time/date, check availability and recalculate price
        if (date || startTime || endTime) {
            const newDate = date ? new Date(date) : booking.date;
            const newStartTime = startTime || booking.startTime;
            const newEndTime = endTime || booking.endTime;
            const isAvailable = await booking_model_1.default.checkAvailability(booking.fieldId, newDate, newStartTime, newEndTime, id // Exclude current booking from check
            );
            if (!isAvailable) {
                throw new AppError_1.AppError('The new time slot is not available', 400);
            }
            // Always recalculate price when rescheduling with the original numberOfDogs
            const field = await field_model_1.default.findById(booking.fieldId);
            if (!field) {
                throw new AppError_1.AppError('Field not found', 404);
            }
            const startMinutes = this.timeToMinutes(newStartTime);
            const endMinutes = this.timeToMinutes(newEndTime);
            const durationHours = (endMinutes - startMinutes) / 60;
            const dogsCount = booking.numberOfDogs || 1; // Always use the original numberOfDogs from booking
            // Calculate price based on field's booking duration setting
            let pricePerUnit = field.price || 0;
            let totalPrice = 0;
            if (field.bookingDuration === '30min') {
                // For 30-minute slots, the price is per 30 minutes
                const duration30MinBlocks = durationHours * 2; // Convert hours to 30-min blocks
                totalPrice = pricePerUnit * duration30MinBlocks * dogsCount;
            }
            else {
                // For hourly slots, price is per hour
                totalPrice = pricePerUnit * durationHours * dogsCount;
            }
            // Ensure totalPrice is a valid number
            if (isNaN(totalPrice) || totalPrice < 0) {
                console.error('Invalid totalPrice calculation:', {
                    pricePerUnit,
                    durationHours,
                    numberOfDogs: dogsCount,
                    bookingDuration: field.bookingDuration,
                    totalPrice
                });
                totalPrice = 0;
            }
            // Log for debugging
            console.log('Reschedule price calculation:', {
                pricePerUnit,
                durationHours,
                numberOfDogs: dogsCount,
                bookingDuration: field.bookingDuration,
                totalPrice
            });
            // Ensure totalPrice is set in the update data
            req.body.totalPrice = totalPrice;
            // Update timeSlot to match the new startTime and endTime
            req.body.timeSlot = `${newStartTime} - ${newEndTime}`;
            // Convert date string to full DateTime if provided
            if (date) {
                req.body.date = new Date(date);
            }
        }
        // Log the final update data
        console.log('Final update data for booking:', req.body);
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
    // Get slot availability (private booking system - slot is either available or booked)
    getSlotAvailability = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { fieldId } = req.params;
        const { date } = req.query;
        if (!date) {
            throw new AppError_1.AppError('Date is required', 400);
        }
        // Get field details
        const field = await database_1.default.field.findUnique({
            where: { id: fieldId }
        });
        if (!field) {
            throw new AppError_1.AppError('Field not found', 404);
        }
        // Parse the date
        const selectedDate = new Date(date);
        const now = new Date();
        // Get start and end of day
        const startOfDayDate = new Date(selectedDate);
        startOfDayDate.setHours(0, 0, 0, 0);
        const endOfDayDate = new Date(selectedDate);
        endOfDayDate.setHours(23, 59, 59, 999);
        // Get all bookings for this field on the selected date (excluding cancelled)
        const bookings = await database_1.default.booking.findMany({
            where: {
                fieldId,
                date: {
                    gte: startOfDayDate,
                    lte: endOfDayDate
                },
                status: {
                    notIn: ['CANCELLED']
                }
            },
            select: {
                startTime: true,
                endTime: true,
                timeSlot: true,
                status: true
            }
        });
        // Generate time slots based on field's operating hours and booking duration
        // Parse opening and closing times to include minutes
        const parseTime = (timeStr) => {
            if (!timeStr)
                return { hour: 0, minute: 0 };
            // First, try to match 12-hour format with AM/PM (e.g., "12:15AM", "2:30 PM")
            const time12Match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (time12Match) {
                let hour = parseInt(time12Match[1]);
                const minute = parseInt(time12Match[2]);
                const period = time12Match[3].toUpperCase();
                // Convert to 24-hour format
                if (period === 'PM' && hour !== 12) {
                    hour += 12;
                }
                else if (period === 'AM' && hour === 12) {
                    hour = 0;
                }
                return { hour, minute };
            }
            // Second, try to match 24-hour format (e.g., "14:30", "02:15")
            const time24Match = timeStr.match(/(\d{1,2}):(\d{2})/);
            if (time24Match) {
                const hour = parseInt(time24Match[1]);
                const minute = parseInt(time24Match[2]);
                return { hour, minute };
            }
            // Fallback: try to parse as just hour
            const hour = parseInt(timeStr.split(':')[0]) || 0;
            return { hour, minute: 0 };
        };
        const openingTime = parseTime(field.openingTime || '6:00AM');
        const closingTime = parseTime(field.closingTime || '9:00PM');
        const slots = [];
        // Determine slot duration based on field's bookingDuration
        const slotDurationMinutes = field.bookingDuration === '30min' ? 30 : 60;
        // Helper function to format time
        const formatTime = (hour, minutes = 0) => {
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const displayMinutes = minutes.toString().padStart(2, '0');
            return `${displayHour}:${displayMinutes}${period}`;
        };
        // Convert time to minutes for easier calculation
        const timeToMinutes = (hour, minute) => {
            return hour * 60 + minute;
        };
        const openingMinutes = timeToMinutes(openingTime.hour, openingTime.minute);
        const closingMinutes = timeToMinutes(closingTime.hour, closingTime.minute);
        // Generate slots from opening to closing time
        let currentMinutes = openingMinutes;
        while (currentMinutes + slotDurationMinutes <= closingMinutes) {
            // Calculate start time
            const startHour = Math.floor(currentMinutes / 60);
            const startMinute = currentMinutes % 60;
            // Calculate end time
            const endTotalMinutes = currentMinutes + slotDurationMinutes;
            const endHour = Math.floor(endTotalMinutes / 60);
            const endMinute = endTotalMinutes % 60;
            // Format times
            const startTime = formatTime(startHour, startMinute);
            const endTime = formatTime(endHour, endMinute);
            const slotTime = `${startTime} - ${endTime}`;
            // Check if this slot is in the past
            const slotDateTime = new Date(selectedDate);
            slotDateTime.setHours(startHour, startMinute, 0, 0);
            const isPast = slotDateTime < now;
            // Check if slot is booked (private booking system)
            const isBooked = bookings.some(booking => booking.timeSlot === slotTime || booking.startTime === startTime);
            slots.push({
                time: slotTime,
                startHour: startHour,
                isPast,
                isBooked,
                isAvailable: !isPast && !isBooked
            });
            // Move to next slot
            currentMinutes += slotDurationMinutes;
        }
        res.json({
            success: true,
            data: {
                date: date,
                fieldId,
                fieldName: field.name,
                slots,
                bookingDuration: field.bookingDuration || '1hour',
                operatingHours: {
                    opening: field.openingTime || '06:00',
                    closing: field.closingTime || '21:00'
                },
                operatingDays: field.operatingDays
            }
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
    // Get my recurring bookings (subscriptions + bookings with repeatBooking)
    getMyRecurringBookings = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const { status = 'active' } = req.query;
        // Get both subscriptions and bookings with repeatBooking !== 'none'
        const [subscriptions, recurringBookings] = await Promise.all([
            // Get user's subscriptions from subscription table
            database_1.default.subscription.findMany({
                where: {
                    userId,
                    ...(status && { status: status })
                },
                include: {
                    field: {
                        include: {
                            owner: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    },
                    bookings: {
                        take: 5,
                        orderBy: {
                            date: 'desc'
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            // Get regular bookings with repeatBooking set (handle case variations)
            database_1.default.booking.findMany({
                where: {
                    userId,
                    AND: [
                        {
                            repeatBooking: {
                                not: null
                            }
                        },
                        {
                            repeatBooking: {
                                notIn: ['none', 'None', 'NONE', '']
                            }
                        }
                    ],
                    status: status === 'active' ? 'CONFIRMED' : { in: ['CANCELLED', 'COMPLETED'] }
                },
                include: {
                    field: {
                        include: {
                            owner: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    },
                    payment: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
        ]);
        // Format subscriptions
        const formattedSubscriptions = subscriptions.map(sub => ({
            id: sub.id,
            type: 'subscription',
            fieldId: sub.fieldId,
            fieldName: sub.field.name,
            fieldAddress: sub.field.address,
            fieldOwner: sub.field.owner.name,
            interval: sub.interval,
            dayOfWeek: sub.dayOfWeek,
            dayOfMonth: sub.dayOfMonth,
            timeSlot: sub.timeSlot,
            startTime: sub.startTime,
            endTime: sub.endTime,
            numberOfDogs: sub.numberOfDogs,
            totalPrice: sub.totalPrice,
            status: sub.status,
            nextBillingDate: sub.nextBillingDate,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            canceledAt: sub.canceledAt,
            recentBookings: sub.bookings.map(booking => ({
                id: booking.id,
                date: booking.date,
                status: booking.status,
                paymentStatus: booking.paymentStatus
            })),
            createdAt: sub.createdAt
        }));
        // Format regular bookings with repeatBooking
        const formattedRecurringBookings = recurringBookings.map(booking => ({
            id: booking.id,
            type: 'booking',
            fieldId: booking.fieldId,
            fieldName: booking.field.name,
            fieldAddress: booking.field.address,
            fieldOwner: booking.field.owner.name || booking.field.owner.email,
            interval: booking.repeatBooking, // 'weekly' or 'monthly'
            dayOfWeek: null, // Could extract from date if needed
            dayOfMonth: null,
            timeSlot: booking.timeSlot,
            startTime: booking.startTime,
            endTime: booking.endTime,
            numberOfDogs: booking.numberOfDogs,
            totalPrice: booking.totalPrice,
            status: booking.status === 'CONFIRMED' ? 'active' : booking.status.toLowerCase(),
            nextBillingDate: booking.date, // Use booking date
            currentPeriodEnd: booking.date,
            cancelAtPeriodEnd: false,
            canceledAt: booking.cancelledAt,
            recentBookings: [{
                    id: booking.id,
                    date: booking.date,
                    status: booking.status,
                    paymentStatus: booking.paymentStatus
                }],
            createdAt: booking.createdAt,
            repeatBooking: booking.repeatBooking // Include original field
        }));
        // Combine both lists
        const allRecurringBookings = [...formattedSubscriptions, ...formattedRecurringBookings];
        // Sort by creation date (newest first)
        allRecurringBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json({
            success: true,
            data: allRecurringBookings,
            total: allRecurringBookings.length,
            breakdown: {
                subscriptions: formattedSubscriptions.length,
                recurringBookings: formattedRecurringBookings.length
            }
        });
    });
    // Cancel recurring booking (subscription)
    cancelRecurringBooking = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const { id: subscriptionId } = req.params;
        const { cancelImmediately = false } = req.body;
        // Find the subscription
        const subscription = await database_1.default.subscription.findUnique({
            where: {
                id: subscriptionId
            },
            include: {
                field: true
            }
        });
        if (!subscription) {
            throw new AppError_1.AppError('Recurring booking not found', 404);
        }
        // Verify ownership
        if (subscription.userId !== userId) {
            throw new AppError_1.AppError('You are not authorized to cancel this recurring booking', 403);
        }
        // Cancel in Stripe if subscription exists
        if (subscription.stripeSubscriptionId) {
            try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                if (cancelImmediately) {
                    // Cancel immediately and issue prorated refund
                    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
                }
                else {
                    // Cancel at period end
                    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                        cancel_at_period_end: true
                    });
                }
            }
            catch (stripeError) {
                console.error('Stripe cancellation error:', stripeError);
                // Continue with local cancellation even if Stripe fails
            }
        }
        // Update subscription in database
        const updatedSubscription = await database_1.default.subscription.update({
            where: {
                id: subscriptionId
            },
            data: {
                status: cancelImmediately ? 'canceled' : subscription.status,
                cancelAtPeriodEnd: !cancelImmediately,
                canceledAt: cancelImmediately ? new Date() : null
            }
        });
        // Cancel future bookings if canceling immediately
        if (cancelImmediately) {
            await database_1.default.booking.updateMany({
                where: {
                    subscriptionId,
                    date: {
                        gte: new Date()
                    },
                    status: {
                        in: ['PENDING', 'CONFIRMED']
                    }
                },
                data: {
                    status: 'CANCELLED',
                    cancellationReason: 'Recurring booking canceled',
                    cancelledAt: new Date()
                }
            });
        }
        // Create notification for user
        await (0, notification_controller_1.createNotification)({
            userId,
            type: 'booking_cancelled',
            title: 'Recurring Booking Canceled',
            message: cancelImmediately
                ? `Your recurring booking for ${subscription.field.name} has been canceled immediately.`
                : `Your recurring booking for ${subscription.field.name} will be canceled at the end of the current period.`,
            metadata: {
                subscriptionId,
                fieldId: subscription.fieldId,
                cancelType: cancelImmediately ? 'immediate' : 'period_end'
            }
        });
        // Create notification for field owner
        await (0, notification_controller_1.createNotification)({
            userId: subscription.field.ownerId,
            type: 'booking_cancelled',
            title: 'Recurring Booking Canceled',
            message: cancelImmediately
                ? `A recurring booking for ${subscription.field.name} has been canceled.`
                : `A recurring booking for ${subscription.field.name} will end after the current period.`,
            metadata: {
                subscriptionId,
                fieldId: subscription.fieldId,
                cancelType: cancelImmediately ? 'immediate' : 'period_end'
            }
        });
        res.json({
            success: true,
            message: cancelImmediately
                ? 'Recurring booking canceled immediately'
                : 'Recurring booking will be canceled at the end of the current period',
            data: updatedSubscription
        });
    });
    // Helper function
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }
}
exports.default = new BookingController();
