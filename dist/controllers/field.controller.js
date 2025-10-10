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
        // Validate minimum operating hours if times are provided
        if (req.body.openingTime && req.body.closingTime) {
            const settings = await database_1.default.systemSettings.findFirst();
            const minimumHours = settings?.minimumFieldOperatingHours || 4;
            const timeToMinutes = (timeStr) => {
                const [hours, minutes] = timeStr.split(':').map(Number);
                return hours * 60 + (minutes || 0);
            };
            const openingMinutes = timeToMinutes(req.body.openingTime);
            const closingMinutes = timeToMinutes(req.body.closingTime);
            const diffHours = (closingMinutes - openingMinutes) / 60;
            if (diffHours < 0) {
                throw new AppError_1.AppError('Closing time must be after opening time', 400);
            }
            if (diffHours < minimumHours) {
                throw new AppError_1.AppError(`Field must be open for at least ${minimumHours} hours`, 400);
            }
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
    // Get all fields with filters and pagination (admin - includes all fields)
    getAllFields = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { search, zipCode, lat, lng, city, state, type, minPrice, maxPrice, amenities, minRating, maxDistance, date, startTime, endTime, numberOfDogs, size, terrainType, fenceType, instantBooking, sortBy, sortOrder, page = 1, limit = 10, } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        // Parse amenities if it's a comma-separated string
        const amenitiesArray = amenities
            ? amenities.split(',').map(a => a.trim())
            : undefined;
        const result = await field_model_1.default.findAll({
            search: search,
            zipCode: zipCode,
            lat: lat ? Number(lat) : undefined,
            lng: lng ? Number(lng) : undefined,
            city: city,
            state: state,
            type: type,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            amenities: amenitiesArray,
            minRating: minRating ? Number(minRating) : undefined,
            maxDistance: maxDistance ? Number(maxDistance) : undefined,
            date: date ? new Date(date) : undefined,
            startTime: startTime,
            endTime: endTime,
            numberOfDogs: numberOfDogs ? Number(numberOfDogs) : undefined,
            size: size,
            terrainType: terrainType,
            fenceType: fenceType,
            instantBooking: instantBooking === 'true' ? true : instantBooking === 'false' ? false : undefined,
            sortBy: sortBy,
            sortOrder: sortOrder,
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
    // Get active fields only (public - for field listing/search)
    getActiveFields = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { search, zipCode, lat, lng, city, state, type, minPrice, maxPrice, amenities, minRating, maxDistance, date, startTime, endTime, numberOfDogs, size, terrainType, fenceType, instantBooking, sortBy, sortOrder, page = 1, limit = 10, } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        // Parse amenities if it's a comma-separated string
        const amenitiesArray = amenities
            ? amenities.split(',').map(a => a.trim())
            : undefined;
        // This method already filters by isActive: true and isSubmitted: true
        const result = await field_model_1.default.findAll({
            search: search,
            zipCode: zipCode,
            lat: lat ? Number(lat) : undefined,
            lng: lng ? Number(lng) : undefined,
            city: city,
            state: state,
            type: type,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            amenities: amenitiesArray,
            minRating: minRating ? Number(minRating) : undefined,
            maxDistance: maxDistance ? Number(maxDistance) : undefined,
            date: date ? new Date(date) : undefined,
            startTime: startTime,
            endTime: endTime,
            numberOfDogs: numberOfDogs ? Number(numberOfDogs) : undefined,
            size: size,
            terrainType: terrainType,
            fenceType: fenceType,
            instantBooking: instantBooking === 'true' ? true : instantBooking === 'false' ? false : undefined,
            sortBy: sortBy,
            sortOrder: sortOrder,
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
    // Get field suggestions for search
    getFieldSuggestions = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { query } = req.query;
        if (!query || query.length < 2) {
            return res.json({
                success: true,
                data: [],
            });
        }
        const suggestions = await field_model_1.default.getSuggestions(query);
        res.json({
            success: true,
            data: suggestions,
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
        // Validate minimum operating hours if times are being updated
        if (req.body.openingTime || req.body.closingTime) {
            const settings = await database_1.default.systemSettings.findFirst();
            const minimumHours = settings?.minimumFieldOperatingHours || 4;
            // Get the current field data to merge with updates
            const openingTime = req.body.openingTime || field.openingTime;
            const closingTime = req.body.closingTime || field.closingTime;
            if (openingTime && closingTime) {
                const timeToMinutes = (timeStr) => {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + (minutes || 0);
                };
                const openingMinutes = timeToMinutes(openingTime);
                const closingMinutes = timeToMinutes(closingTime);
                const diffHours = (closingMinutes - openingMinutes) / 60;
                if (diffHours < 0) {
                    throw new AppError_1.AppError('Closing time must be after opening time', 400);
                }
                if (diffHours < minimumHours) {
                    throw new AppError_1.AppError(`Field must be open for at least ${minimumHours} hours`, 400);
                }
            }
        }
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
    // Get nearby fields based on lat/lng
    getNearbyFields = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const { lat, lng, radius = 10, page = 1, limit = 12 } = req.query;
        // Validate required parameters
        if (!lat || !lng) {
            throw new AppError_1.AppError('Latitude and longitude are required', 400);
        }
        // Validate lat/lng values
        const latitude = Number(lat);
        const longitude = Number(lng);
        if (isNaN(latitude) || isNaN(longitude)) {
            throw new AppError_1.AppError('Invalid latitude or longitude values', 400);
        }
        if (latitude < -90 || latitude > 90) {
            throw new AppError_1.AppError('Latitude must be between -90 and 90', 400);
        }
        if (longitude < -180 || longitude > 180) {
            throw new AppError_1.AppError('Longitude must be between -180 and 180', 400);
        }
        const radiusNum = Number(radius);
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        // Search for nearby fields
        const nearbyFields = await field_model_1.default.searchByLocation(latitude, longitude, radiusNum);
        // Apply pagination to results
        const total = nearbyFields.length;
        const paginatedFields = nearbyFields.slice(skip, skip + limitNum);
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            success: true,
            data: paginatedFields,
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
        const { step, data, fieldId: providedFieldId } = req.body;
        // Check if we're updating an existing field or creating a new one
        let fieldId;
        let isNewField = false;
        // If fieldId is provided, use it; otherwise create a new field
        if (providedFieldId) {
            // Verify ownership
            const existingField = await field_model_1.default.findById(providedFieldId);
            if (!existingField || existingField.ownerId !== ownerId) {
                throw new AppError_1.AppError('Field not found or you do not have permission', 403);
            }
            fieldId = providedFieldId;
        }
        else {
            // Create a new field
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
                // Validate minimum operating hours
                if (data.startTime && data.endTime) {
                    const settings = await database_1.default.systemSettings.findFirst();
                    const minimumHours = settings?.minimumFieldOperatingHours || 4;
                    const timeToMinutes = (timeStr) => {
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        return hours * 60 + (minutes || 0);
                    };
                    const openingMinutes = timeToMinutes(data.startTime);
                    const closingMinutes = timeToMinutes(data.endTime);
                    const diffHours = (closingMinutes - openingMinutes) / 60;
                    if (diffHours < 0) {
                        throw new AppError_1.AppError('Closing time must be after opening time', 400);
                    }
                    if (diffHours < minimumHours) {
                        throw new AppError_1.AppError(`Field must be open for at least ${minimumHours} hours`, 400);
                    }
                }
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
                    // Store location object if provided
                    location: data.location || null,
                    // Also store legacy fields for backward compatibility
                    address: data.streetAddress,
                    // apartment field removed - doesn't exist in schema
                    city: data.city,
                    state: data.county,
                    zipCode: data.postalCode,
                    // Extract lat/lng from location object if available
                    latitude: data.location?.lat || null,
                    longitude: data.location?.lng || null,
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
        let updateData = {};
        // Update based on which step is being saved
        switch (step) {
            case 'field-details':
                // Validate minimum operating hours
                if (data.startTime && data.endTime) {
                    const settings = await database_1.default.systemSettings.findFirst();
                    const minimumHours = settings?.minimumFieldOperatingHours || 4;
                    const timeToMinutes = (timeStr) => {
                        const [hours, minutes] = timeStr.split(':').map(Number);
                        return hours * 60 + (minutes || 0);
                    };
                    const openingMinutes = timeToMinutes(data.startTime);
                    const closingMinutes = timeToMinutes(data.endTime);
                    const diffHours = (closingMinutes - openingMinutes) / 60;
                    if (diffHours < 0) {
                        throw new AppError_1.AppError('Closing time must be after opening time', 400);
                    }
                    if (diffHours < minimumHours) {
                        throw new AppError_1.AppError(`Field must be open for at least ${minimumHours} hours`, 400);
                    }
                }
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
                    // Store location object if provided
                    location: data.location || null,
                    // Also store legacy fields for backward compatibility
                    address: data.streetAddress,
                    // apartment field removed - doesn't exist in schema
                    city: data.city,
                    state: data.county,
                    zipCode: data.postalCode,
                    // Extract lat/lng from location object if available
                    latitude: data.location?.lat || null,
                    longitude: data.location?.lng || null,
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
                        price: parseFloat(data.price || data.pricePerHour) || 0,
                        bookingDuration: data.bookingDuration || '1hour',
                        instantBooking: data.instantBooking || false,
                        pricingAvailabilityCompleted: true
                    };
                }
                else {
                    updateData = {
                        price: parseFloat(data.price || data.pricePerHour) || 0,
                        bookingDuration: data.bookingDuration || '1hour',
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
        // Note: Field should only become active after submission via submitFieldForReview
        // Do not auto-activate when steps are completed
        res.json({
            success: true,
            message: isNewField ? 'Field created and progress saved' : 'Progress saved',
            fieldId: field.id,
            stepCompleted: true,
            allStepsCompleted,
            isActive: field.isActive, // Return actual isActive status
            isNewField
        });
    });
    // Submit field for review
    submitFieldForReview = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const { fieldId } = req.body;
        // Get the field - use fieldId if provided, otherwise get first field
        let field;
        if (fieldId) {
            field = await field_model_1.default.findById(fieldId);
            // Verify ownership
            if (field && field.ownerId !== ownerId) {
                throw new AppError_1.AppError('You can only submit your own fields', 403);
            }
        }
        else {
            field = await field_model_1.default.findOneByOwner(ownerId);
        }
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
            // First get all owner's fields
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
            // Get all field IDs for this owner
            const fieldIds = fields.map((field) => field.id);
            // Get bookings from database
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            let bookingFilter = { fieldId: { in: fieldIds } };
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
            // Get overall stats across all fields
            const totalBookings = await database_1.default.booking.count({
                where: { fieldId: { in: fieldIds } }
            });
            const todayBookings = await database_1.default.booking.count({
                where: {
                    fieldId: { in: fieldIds },
                    date: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            });
            const totalEarnings = await database_1.default.booking.aggregate({
                where: {
                    fieldId: { in: fieldIds },
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
    // Get today's bookings for field owner
    getTodayBookings = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const { page = 1, limit = 12 } = req.query;
        try {
            // First get all owner's fields
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
            // Get all field IDs for this owner
            const fieldIds = fields.map((field) => field.id);
            // Get today's date range
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const bookingFilter = {
                fieldId: { in: fieldIds },
                date: {
                    gte: today,
                    lt: tomorrow
                }
            };
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skip = (pageNum - 1) * limitNum;
            // Fetch bookings with user details, field details, and count
            const [bookings, totalFilteredBookings] = await Promise.all([
                database_1.default.booking.findMany({
                    where: bookingFilter,
                    include: {
                        user: true,
                        field: true
                    },
                    orderBy: {
                        date: 'asc'
                    },
                    skip,
                    take: limitNum
                }),
                database_1.default.booking.count({ where: bookingFilter })
            ]);
            // Get overall stats across all fields
            const [totalBookings, totalEarnings] = await Promise.all([
                database_1.default.booking.count({ where: { fieldId: { in: fieldIds } } }),
                database_1.default.booking.aggregate({
                    where: {
                        fieldId: { in: fieldIds },
                        status: 'COMPLETED'
                    },
                    _sum: {
                        totalPrice: true
                    }
                })
            ]);
            // Format bookings for frontend
            const formattedBookings = bookings.map((booking) => ({
                id: booking.id,
                userId: booking.user.id,
                userName: booking.user.name,
                userAvatar: booking.user.profileImage || null,
                userEmail: booking.user.email,
                userPhone: booking.user.phone,
                time: `${booking.startTime} - ${booking.endTime}`,
                orderId: `#${booking.id.substring(0, 6).toUpperCase()}`,
                status: booking.status.toLowerCase(),
                frequency: booking.recurring || 'NA',
                dogs: booking.numberOfDogs || 1,
                amount: booking.totalPrice,
                date: booking.date.toISOString(),
                fieldName: booking.field.name,
                fieldAddress: `${booking.field.address}, ${booking.field.city}`,
                notes: booking.notes || null
            }));
            res.status(200).json({
                success: true,
                bookings: formattedBookings,
                stats: {
                    todayBookings: totalFilteredBookings,
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
            console.error('Error fetching today bookings:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch today bookings',
                bookings: [],
                stats: {
                    todayBookings: 0,
                    totalBookings: 0,
                    totalEarnings: 0
                }
            });
        }
    });
    // Get upcoming bookings for field owner
    getUpcomingBookings = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const { page = 1, limit = 12 } = req.query;
        try {
            // First get all owner's fields
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
            // Get all field IDs for this owner
            const fieldIds = fields.map((field) => field.id);
            // Get tomorrow and beyond
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const bookingFilter = {
                fieldId: { in: fieldIds },
                date: {
                    gte: tomorrow
                }
            };
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skip = (pageNum - 1) * limitNum;
            // Fetch bookings with user and field details and count
            const [bookings, totalFilteredBookings] = await Promise.all([
                database_1.default.booking.findMany({
                    where: bookingFilter,
                    include: {
                        user: true,
                        field: true
                    },
                    orderBy: {
                        date: 'asc'
                    },
                    skip,
                    take: limitNum
                }),
                database_1.default.booking.count({ where: bookingFilter })
            ]);
            // Get overall stats across all fields
            const [totalBookings, todayBookings, totalEarnings] = await Promise.all([
                database_1.default.booking.count({ where: { fieldId: { in: fieldIds } } }),
                database_1.default.booking.count({
                    where: {
                        fieldId: { in: fieldIds },
                        date: {
                            gte: today,
                            lt: tomorrow
                        }
                    }
                }),
                database_1.default.booking.aggregate({
                    where: {
                        fieldId: { in: fieldIds },
                        status: 'COMPLETED'
                    },
                    _sum: {
                        totalPrice: true
                    }
                })
            ]);
            // Format bookings for frontend
            const formattedBookings = bookings.map((booking) => ({
                id: booking.id,
                userId: booking.user.id,
                userName: booking.user.name,
                userAvatar: booking.user.profileImage || null,
                userEmail: booking.user.email,
                userPhone: booking.user.phone,
                time: `${booking.startTime} - ${booking.endTime}`,
                orderId: `#${booking.id.substring(0, 6).toUpperCase()}`,
                status: booking.status.toLowerCase(),
                frequency: booking.recurring || 'NA',
                dogs: booking.numberOfDogs || 1,
                amount: booking.totalPrice,
                date: booking.date.toISOString(),
                fieldName: booking.field.name,
                fieldAddress: `${booking.field.address}, ${booking.field.city}`,
                notes: booking.notes || null
            }));
            res.status(200).json({
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
            console.error('Error fetching upcoming bookings:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch upcoming bookings',
                bookings: [],
                stats: {
                    todayBookings: 0,
                    totalBookings: 0,
                    totalEarnings: 0
                }
            });
        }
    });
    // Get previous bookings for field owner
    getPreviousBookings = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const { page = 1, limit = 12 } = req.query;
        try {
            // First get all owner's fields
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
            // Get all field IDs for this owner
            const fieldIds = fields.map((field) => field.id);
            // Get past bookings
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const bookingFilter = {
                fieldId: { in: fieldIds },
                date: {
                    lt: today
                }
            };
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skip = (pageNum - 1) * limitNum;
            // Fetch bookings with user and field details and count
            const [bookings, totalFilteredBookings] = await Promise.all([
                database_1.default.booking.findMany({
                    where: bookingFilter,
                    include: {
                        user: true,
                        field: true
                    },
                    orderBy: {
                        date: 'desc'
                    },
                    skip,
                    take: limitNum
                }),
                database_1.default.booking.count({ where: bookingFilter })
            ]);
            // Get overall stats across all fields
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const [totalBookings, todayBookings, totalEarnings] = await Promise.all([
                database_1.default.booking.count({ where: { fieldId: { in: fieldIds } } }),
                database_1.default.booking.count({
                    where: {
                        fieldId: { in: fieldIds },
                        date: {
                            gte: today,
                            lt: tomorrow
                        }
                    }
                }),
                database_1.default.booking.aggregate({
                    where: {
                        fieldId: { in: fieldIds },
                        status: 'COMPLETED'
                    },
                    _sum: {
                        totalPrice: true
                    }
                })
            ]);
            // Format bookings for frontend
            const formattedBookings = bookings.map((booking) => ({
                id: booking.id,
                userId: booking.user.id,
                userName: booking.user.name,
                userAvatar: booking.user.profileImage || null,
                userEmail: booking.user.email,
                userPhone: booking.user.phone,
                time: `${booking.startTime} - ${booking.endTime}`,
                orderId: `#${booking.id.substring(0, 6).toUpperCase()}`,
                status: booking.status.toLowerCase(),
                frequency: booking.recurring || 'NA',
                dogs: booking.numberOfDogs || 1,
                amount: booking.totalPrice,
                date: booking.date.toISOString(),
                fieldName: booking.field.name,
                fieldAddress: `${booking.field.address}, ${booking.field.city}`,
                notes: booking.notes || null
            }));
            res.status(200).json({
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
            console.error('Error fetching previous bookings:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch previous bookings',
                bookings: [],
                stats: {
                    todayBookings: 0,
                    totalBookings: 0,
                    totalEarnings: 0
                }
            });
        }
    });
    // Get recent bookings for field owner
    getRecentBookings = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const ownerId = req.user.id;
        const { limit = 5 } = req.query;
        const limitNum = Number(limit);
        try {
            // First get the owner's field
            const fields = await field_model_1.default.findByOwner(ownerId);
            if (!fields || fields.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No field found for this owner',
                    bookings: []
                });
            }
            const fieldId = fields[0].id;
            // Get recent bookings
            const bookings = await database_1.default.booking.findMany({
                where: {
                    fieldId,
                    status: {
                        in: ['CONFIRMED', 'COMPLETED']
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: limitNum,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            image: true
                        }
                    }
                }
            });
            // Format bookings
            const formattedBookings = bookings.map(booking => ({
                id: booking.id,
                date: booking.date,
                startTime: booking.startTime,
                endTime: booking.endTime,
                numberOfDogs: booking.numberOfDogs,
                totalPrice: booking.totalPrice,
                status: booking.status,
                createdAt: booking.createdAt,
                user: {
                    id: booking.user.id,
                    name: booking.user.name || 'Unknown',
                    email: booking.user.email,
                    phone: booking.user.phone,
                    profilePicture: booking.user.image
                }
            }));
            res.status(200).json({
                success: true,
                bookings: formattedBookings
            });
        }
        catch (error) {
            console.error('Error fetching recent bookings:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch recent bookings',
                bookings: []
            });
        }
    });
    // Get fields available for claiming
    getFieldForClaim = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const fields = await database_1.default.field.findMany({
            where: {
                isClaimed: false,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                images: true,
                size: true,
                price: true,
                bookingDuration: true
            }
        });
        res.status(200).json({
            success: true,
            data: fields
        });
    });
    // Claim a field
    claimField = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { fieldId } = req.body;
        const userId = req.user.id;
        if (!fieldId) {
            return res.status(400).json({
                success: false,
                message: 'Field ID is required'
            });
        }
        // Check if field exists and is not already claimed
        const field = await database_1.default.field.findUnique({
            where: { id: fieldId }
        });
        if (!field) {
            return res.status(404).json({
                success: false,
                message: 'Field not found'
            });
        }
        if (field.isClaimed) {
            return res.status(400).json({
                success: false,
                message: 'This field has already been claimed'
            });
        }
        // Update field with owner information
        const updatedField = await database_1.default.field.update({
            where: { id: fieldId },
            data: {
                isClaimed: true,
                ownerId: userId,
                ownerName: req.user.name || req.user.email,
                joinedOn: new Date()
            }
        });
        res.status(200).json({
            success: true,
            message: 'Field claimed successfully',
            data: updatedField
        });
    });
}
exports.default = new FieldController();
