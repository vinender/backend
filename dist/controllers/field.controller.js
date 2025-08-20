"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const field_model_1 = __importDefault(require("../models/field.model"));
const asyncHandler_1 = require("../utils/asyncHandler");
const AppError_1 = require("../utils/AppError");
const database_1 = __importDefault(require("../config/database"));
class FieldController {
    // Create new field
    createField = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const userRole = req.user.role;
        // Only field owners can create fields
        if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
            throw new AppError_1.AppError('Only field owners can create fields', 403);
        }
        // Check if owner already has a field (one field per owner restriction)
        const existingFields = await field_model_1.default.findByOwner(ownerId);
        if (existingFields && existingFields.length > 0) {
            throw new AppError_1.AppError('Field owners can only have one field. Please update your existing field instead.', 400);
        }
        const fieldData = {
            ...req.body,
            ownerId,
        };
        const field = await field_model_1.default.create(fieldData);
        res.status(201).json({
            success: true,
            message: 'Field created successfully',
            data: field,
        });
    });
    // Get all fields with filters and pagination
    getAllFields = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { city, state, type, minPrice, maxPrice, search, page = 1, limit = 10, } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        const result = await field_model_1.default.findAll({
            city: city,
            state: state,
            type: type,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            skip,
            take: limitNum,
        });
        const totalPages = Math.ceil(result.total / limitNum);
        res.json({
            success: true,
            data: result.fields,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: result.total,
                totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
            },
        });
    });
    // Get field by ID
    getField = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const field = await field_model_1.default.findById(id);
        if (!field) {
            throw new AppError_1.AppError('Field not found', 404);
        }
        res.json({
            success: true,
            data: field,
        });
    });
    // Get fields by owner
    getMyFields = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const fields = await field_model_1.default.findByOwner(ownerId);
        res.json({
            success: true,
            data: fields,
            total: fields.length,
        });
    });
    // Update field
    updateField = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        // Check ownership
        const field = await field_model_1.default.findById(id);
        if (!field) {
            throw new AppError_1.AppError('Field not found', 404);
        }
        if (field.ownerId !== userId && userRole !== 'ADMIN') {
            throw new AppError_1.AppError('You can only update your own fields', 403);
        }
        // Prevent updating certain fields
        delete req.body.id;
        delete req.body.ownerId;
        const updatedField = await field_model_1.default.update(id, req.body);
        res.json({
            success: true,
            message: 'Field updated successfully',
            data: updatedField,
        });
    });
    // Delete field
    deleteField = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        // Check ownership
        const field = await field_model_1.default.findById(id);
        if (!field) {
            throw new AppError_1.AppError('Field not found', 404);
        }
        if (field.ownerId !== userId && userRole !== 'ADMIN') {
            throw new AppError_1.AppError('You can only delete your own fields', 403);
        }
        await field_model_1.default.delete(id);
        res.status(204).json({
            success: true,
            message: 'Field deleted successfully',
        });
    });
    // Toggle field active status
    toggleFieldStatus = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        // Check ownership
        const field = await field_model_1.default.findById(id);
        if (!field) {
            throw new AppError_1.AppError('Field not found', 404);
        }
        if (field.ownerId !== userId && userRole !== 'ADMIN') {
            throw new AppError_1.AppError('You can only toggle your own fields', 403);
        }
        const updatedField = await field_model_1.default.toggleActive(id);
        res.json({
            success: true,
            message: `Field ${updatedField.isActive ? 'activated' : 'deactivated'} successfully`,
            data: updatedField,
        });
    });
    // Search fields by location
    searchByLocation = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { lat, lng, radius = 10 } = req.query;
        if (!lat || !lng) {
            throw new AppError_1.AppError('Latitude and longitude are required', 400);
        }
        const fields = await field_model_1.default.searchByLocation(Number(lat), Number(lng), Number(radius));
        res.json({
            success: true,
            data: fields,
            total: fields.length,
        });
    });
    // Get field owner's single field (since they can only have one)
    getOwnerField = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const field = await field_model_1.default.findOneByOwner(ownerId);
        if (!field) {
            // Return success with null field to indicate no field exists yet
            // This allows the frontend to show the add field form
            return res.status(200).json({
                success: true,
                message: 'No field found. Please add your field.',
                field: null,
                showAddForm: true
            });
        }
        // Return the field with step completion status
        res.json({
            success: true,
            field: {
                ...field,
                stepStatus: {
                    fieldDetails: field.fieldDetailsCompleted || false,
                    uploadImages: field.uploadImagesCompleted || false,
                    pricingAvailability: field.pricingAvailabilityCompleted || false,
                    bookingRules: field.bookingRulesCompleted || false
                },
                allStepsCompleted: field.fieldDetailsCompleted &&
                    field.uploadImagesCompleted &&
                    field.pricingAvailabilityCompleted &&
                    field.bookingRulesCompleted
            }
        });
    });
    // Save field progress (auto-save functionality)
    saveFieldProgress = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const { step, data } = req.body;
        // Check if field already exists for this owner
        const existingFields = await field_model_1.default.findByOwner(ownerId);
        let fieldId;
        let isNewField = false;
        // If no field exists, create a new one with initial data
        if (!existingFields || existingFields.length === 0) {
            // Create a new field with the data from the first step
            // This handles the case where the field was deleted or never created
            isNewField = true;
            // Prepare initial field data based on the step
            let initialFieldData = {
                ownerId,
                isActive: false,
                fieldDetailsCompleted: false,
                uploadImagesCompleted: false,
                pricingAvailabilityCompleted: false,
                bookingRulesCompleted: false,
            };
            // If the first step is field-details, include that data
            if (step === 'field-details') {
                initialFieldData = {
                    ...initialFieldData,
                    name: data.fieldName,
                    size: data.fieldSize,
                    terrainType: data.terrainType,
                    fenceType: data.fenceType,
                    fenceSize: data.fenceSize,
                    surfaceType: data.surfaceType,
                    type: 'PRIVATE',
                    description: data.description,
                    maxDogs: parseInt(data.maxDogs) || 10,
                    openingTime: data.startTime,
                    closingTime: data.endTime,
                    operatingDays: data.openingDays ? [data.openingDays] : [],
                    amenities: Object.keys(data.amenities || {}).filter(key => data.amenities[key]),
                    address: data.streetAddress,
                    apartment: data.apartment,
                    city: data.city,
                    state: data.county,
                    zipCode: data.postalCode,
                    country: data.country,
                    fieldDetailsCompleted: true
                };
            }
            // Create the new field
            const newField = await field_model_1.default.create(initialFieldData);
            fieldId = newField.id;
            // If we've already processed the data in field creation, we're done
            if (step === 'field-details') {
                return res.json({
                    success: true,
                    message: 'Field created and progress saved',
                    fieldId: newField.id,
                    stepCompleted: true,
                    allStepsCompleted: false,
                    isActive: false,
                    isNewField: true
                });
            }
        }
        else {
            fieldId = existingFields[0].id;
        }
        let updateData = {};
        // Update based on which step is being saved
        switch (step) {
            case 'field-details':
                updateData = {
                    name: data.fieldName,
                    size: data.fieldSize,
                    terrainType: data.terrainType, // This is terrain type, not field type
                    fenceType: data.fenceType,
                    fenceSize: data.fenceSize,
                    surfaceType: data.surfaceType,
                    type: 'PRIVATE', // Default field type - you can add a field type selector in the form if needed
                    description: data.description,
                    maxDogs: parseInt(data.maxDogs) || 10,
                    openingTime: data.startTime,
                    closingTime: data.endTime,
                    operatingDays: data.openingDays ? [data.openingDays] : [],
                    amenities: Object.keys(data.amenities || {}).filter(key => data.amenities[key]),
                    address: data.streetAddress,
                    apartment: data.apartment,
                    city: data.city,
                    state: data.county,
                    zipCode: data.postalCode,
                    country: data.country,
                    fieldDetailsCompleted: true
                };
                break;
            case 'upload-images':
                // If this is a new field created from a non-field-details step, 
                // we need to ensure basic field info exists
                if (isNewField) {
                    updateData = {
                        name: 'Untitled Field',
                        type: 'PRIVATE',
                        images: data.images || [],
                        uploadImagesCompleted: true
                    };
                }
                else {
                    updateData = {
                        images: data.images || [],
                        uploadImagesCompleted: true
                    };
                }
                break;
            case 'pricing-availability':
                if (isNewField) {
                    updateData = {
                        name: 'Untitled Field',
                        type: 'PRIVATE',
                        pricePerHour: parseFloat(data.pricePerHour) || 0,
                        pricePerDay: data.weekendPrice ? parseFloat(data.weekendPrice) : null,
                        instantBooking: data.instantBooking || false,
                        pricingAvailabilityCompleted: true
                    };
                }
                else {
                    updateData = {
                        pricePerHour: parseFloat(data.pricePerHour) || 0,
                        pricePerDay: data.weekendPrice ? parseFloat(data.weekendPrice) : null,
                        instantBooking: data.instantBooking || false,
                        pricingAvailabilityCompleted: true
                    };
                }
                break;
            case 'booking-rules':
                if (isNewField) {
                    updateData = {
                        name: 'Untitled Field',
                        type: 'PRIVATE',
                        rules: data.rules ? [data.rules] : [],
                        cancellationPolicy: data.policies || '',
                        bookingRulesCompleted: true
                    };
                }
                else {
                    updateData = {
                        rules: data.rules ? [data.rules] : [],
                        cancellationPolicy: data.policies || '',
                        bookingRulesCompleted: true
                    };
                }
                break;
            default:
                throw new AppError_1.AppError('Invalid step', 400);
        }
        // Update field
        const field = await field_model_1.default.update(fieldId, updateData);
        // Check if all steps are completed
        const allStepsCompleted = field.fieldDetailsCompleted &&
            field.uploadImagesCompleted &&
            field.pricingAvailabilityCompleted &&
            field.bookingRulesCompleted;
        // If all steps completed, activate the field
        if (allStepsCompleted && !field.isActive) {
            await field_model_1.default.update(fieldId, { isActive: true });
        }
        res.json({
            success: true,
            message: isNewField ? 'Field created and progress saved' : 'Progress saved',
            fieldId: field.id,
            stepCompleted: true,
            allStepsCompleted,
            isActive: allStepsCompleted,
            isNewField
        });
    });
    // Submit field for review
    submitFieldForReview = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        // Get the field
        const field = await field_model_1.default.findOneByOwner(ownerId);
        if (!field) {
            throw new AppError_1.AppError('No field found for this owner', 404);
        }
        // Check if all steps are completed
        if (!field.fieldDetailsCompleted ||
            !field.uploadImagesCompleted ||
            !field.pricingAvailabilityCompleted ||
            !field.bookingRulesCompleted) {
            throw new AppError_1.AppError('Please complete all steps before submitting', 400);
        }
        // Submit the field
        const submittedField = await field_model_1.default.submitField(field.id);
        res.json({
            success: true,
            message: 'Field submitted successfully!',
            data: submittedField
        });
    });
    // Get bookings for field owner's field
    getFieldBookings = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const { status = 'all', page = 1, limit = 10 } = req.query;
        try {
            // First get the owner's field
            const fields = await field_model_1.default.findByOwner(ownerId);
            if (!fields || fields.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No field found for this owner',
                    bookings: [],
                    stats: {
                        todayBookings: 0,
                        totalBookings: 0,
                        totalEarnings: 0
                    }
                });
            }
            const fieldId = fields[0].id;
            // Get bookings from database
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            let bookingFilter = { fieldId };
            // Filter based on status
            if (status === 'today') {
                bookingFilter.date = {
                    gte: today,
                    lt: tomorrow
                };
            }
            else if (status === 'upcoming') {
                bookingFilter.date = {
                    gte: tomorrow
                };
            }
            else if (status === 'previous') {
                bookingFilter.date = {
                    lt: today
                };
            }
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skip = (pageNum - 1) * limitNum;
            // Fetch bookings with user details and count
            const [bookings, totalFilteredBookings] = await Promise.all([
                database_1.default.booking.findMany({
                    where: bookingFilter,
                    include: {
                        user: true
                    },
                    orderBy: {
                        date: status === 'previous' ? 'desc' : 'asc'
                    },
                    skip,
                    take: limitNum
                }),
                database_1.default.booking.count({ where: bookingFilter })
            ]);
            // Get overall stats
            const totalBookings = await database_1.default.booking.count({
                where: { fieldId }
            });
            const todayBookings = await database_1.default.booking.count({
                where: {
                    fieldId,
                    date: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            });
            const totalEarnings = await database_1.default.booking.aggregate({
                where: {
                    fieldId,
                    status: 'COMPLETED'
                },
                _sum: {
                    totalPrice: true
                }
            });
            // Format bookings for frontend
            const formattedBookings = bookings.map((booking) => ({
                id: booking.id,
                userName: booking.user.name,
                userAvatar: booking.user.profileImage || null,
                time: `${booking.startTime} - ${booking.endTime}`,
                orderId: `#${booking.id.substring(0, 6).toUpperCase()}`,
                status: booking.status.toLowerCase(),
                frequency: 'NA', // Add recurring logic if needed
                dogs: booking.numberOfDogs,
                amount: booking.totalPrice,
                date: booking.date
            }));
            res.json({
                success: true,
                bookings: formattedBookings,
                stats: {
                    todayBookings,
                    totalBookings,
                    totalEarnings: totalEarnings._sum.totalPrice || 0
                },
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalFilteredBookings,
                    totalPages: Math.ceil(totalFilteredBookings / limitNum),
                    hasNextPage: pageNum < Math.ceil(totalFilteredBookings / limitNum),
                    hasPrevPage: pageNum > 1
                }
            });
        }
        catch (error) {
            console.error('Error fetching bookings:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch bookings',
                bookings: [],
                stats: {
                    todayBookings: 0,
                    totalBookings: 0,
                    totalEarnings: 0
                }
            });
        }
    });
}
exports.default = new FieldController();
