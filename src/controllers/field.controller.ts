//@ts-nocheck
import { Request, Response, NextFunction } from 'express';
import FieldModel from '../models/field.model';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import prisma from '../config/database';
import { enrichFieldWithAmenities, enrichFieldsWithAmenities } from '../utils/amenity.utils';
import { convertAmenityIdsToNames } from '../utils/amenity.converter';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client for image deletion
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

class FieldController {
  // Create new field
  createField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Only field owners can create fields
    if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
      throw new AppError('Only field owners can create fields', 403);
    }

    // Validate minimum operating hours if times are provided
    if (req.body.openingTime && req.body.closingTime) {
      const settings = await prisma.systemSettings.findFirst();
      const minimumHours = settings?.minimumFieldOperatingHours || 4;
      
      const timeToMinutes = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + (minutes || 0);
      };
      
      const openingMinutes = timeToMinutes(req.body.openingTime);
      const closingMinutes = timeToMinutes(req.body.closingTime);
      const diffHours = (closingMinutes - openingMinutes) / 60;
      
      if (diffHours < 0) {
        throw new AppError('Closing time must be after opening time', 400);
      }
      
      if (diffHours < minimumHours) {
        throw new AppError(`Field must be open for at least ${minimumHours} hours`, 400);
      }
    }

    // Convert amenity IDs to names if amenities are provided
    let amenityNames = req.body.amenities || [];
    if (amenityNames && amenityNames.length > 0) {
      amenityNames = await convertAmenityIdsToNames(amenityNames);
    }

    const fieldData = {
      ...req.body,
      amenities: amenityNames,
      ownerId,
    };

    const field = await FieldModel.create(fieldData);

    // Enrich field with full amenity objects
    const enrichedField = await enrichFieldWithAmenities(field);

    res.status(201).json({
      success: true,
      message: 'Field created successfully',
      data: enrichedField,
    });
  });

  // Get all fields with filters and pagination (admin - includes all fields)
  getAllFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
      search,
      zipCode,
      lat,
      lng,
      city,
      state,
      type,
      minPrice,
      maxPrice,
      amenities,
      minRating,
      maxDistance,
      date,
      startTime,
      endTime,
      numberOfDogs,
      size,
      terrainType,
      fenceType,
      instantBooking,
      sortBy,
      sortOrder,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Parse amenities if it's a comma-separated string
    const amenitiesArray = amenities
      ? (amenities as string).split(',').map(a => a.trim())
      : undefined;

    const result = await FieldModel.findAll({
      search: search as string,
      zipCode: zipCode as string,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      city: city as string,
      state: state as string,
      type: type as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      amenities: amenitiesArray,
      minRating: minRating ? Number(minRating) : undefined,
      maxDistance: maxDistance ? Number(maxDistance) : undefined,
      date: date ? new Date(date as string) : undefined,
      startTime: startTime as string,
      endTime: endTime as string,
      numberOfDogs: numberOfDogs ? Number(numberOfDogs) : undefined,
      size: size as string,
      terrainType: terrainType as string,
      fenceType: fenceType as string,
      instantBooking: instantBooking === 'true' ? true : instantBooking === 'false' ? false : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      skip,
      take: limitNum,
    });

    // Enrich fields with full amenity objects
    const enrichedFields = await enrichFieldsWithAmenities(result.fields);

    const totalPages = Math.ceil(result.total / limitNum);

    res.json({
      success: true,
      data: enrichedFields,
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
  getActiveFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
      search,
      zipCode,
      lat,
      lng,
      city,
      state,
      type,
      minPrice,
      maxPrice,
      amenities,
      minRating,
      maxDistance,
      date,
      startTime,
      endTime,
      numberOfDogs,
      size,
      terrainType,
      fenceType,
      instantBooking,
      sortBy,
      sortOrder,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Parse amenities if it's a comma-separated string
    const amenitiesArray = amenities
      ? (amenities as string).split(',').map(a => a.trim())
      : undefined;

    // This method already filters by isActive: true and isSubmitted: true
    const result = await FieldModel.findAll({
      search: search as string,
      zipCode: zipCode as string,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      city: city as string,
      state: state as string,
      type: type as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      amenities: amenitiesArray,
      minRating: minRating ? Number(minRating) : undefined,
      maxDistance: maxDistance ? Number(maxDistance) : undefined,
      date: date ? new Date(date as string) : undefined,
      startTime: startTime as string,
      endTime: endTime as string,
      numberOfDogs: numberOfDogs ? Number(numberOfDogs) : undefined,
      size: size as string,
      terrainType: terrainType as string,
      fenceType: fenceType as string,
      instantBooking: instantBooking === 'true' ? true : instantBooking === 'false' ? false : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      skip,
      take: limitNum,
    });

    // Transform and calculate distance for each field if user location is provided
    const userLat = lat ? Number(lat) : null;
    const userLng = lng ? Number(lng) : null;

    const transformedFields = result.fields.map((field: any) => {
      // Get field coordinates from location JSON or legacy lat/lng fields
      // Handle both Prisma Json type and actual parsed object
      const locationData = typeof field.location === 'string'
        ? JSON.parse(field.location)
        : field.location;

      const fieldLat = locationData?.lat || field.latitude;
      const fieldLng = locationData?.lng || field.longitude;

      // Build optimized response with only necessary fields
      const optimizedField: any = {
        id: field.id,
        name: field.name,
        image: field.images?.[0] || null, // Only send first image for card
        price: field.price,
        duration: field.bookingDuration || 'hour', // 'hour' or '30min'
        rating: field.averageRating || 0,
        reviewCount: field.totalReviews || 0,
        amenities: field.amenities?.slice(0, 4) || [], // Only first 4 amenities for card
        isClaimed: field.isClaimed,
        owner: field.ownerName || 'Field Owner',
        // Location info
        location: {
          address: field.address,
          city: field.city,
          state: field.state,
          zipCode: field.zipCode,
          lat: fieldLat,
          lng: fieldLng,
        },
        // Formatted location string for display
        locationDisplay: [field.city, field.state].filter(Boolean).join(', '),
      };

      // Calculate distance if user location is provided and field has coordinates
      if (userLat && userLng && fieldLat && fieldLng) {
        // Haversine formula to calculate distance in miles
        const R = 3959; // Earth's radius in miles
        const dLat = (fieldLat - userLat) * Math.PI / 180;
        const dLng = (fieldLng - userLng) * Math.PI / 180;

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(userLat * Math.PI / 180) * Math.cos(fieldLat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceMiles = R * c;

        optimizedField.distance = Number(distanceMiles.toFixed(1));
        optimizedField.distanceDisplay = distanceMiles < 1
          ? `${(distanceMiles * 1760).toFixed(0)} yards`
          : `${distanceMiles.toFixed(1)} miles`;
      }

      return optimizedField;
    });

    // Enrich fields with full amenity objects (only for the amenities we're sending)
    const enrichedFields = await enrichFieldsWithAmenities(transformedFields);

    const totalPages = Math.ceil(result.total / limitNum);

    res.json({
      success: true,
      data: enrichedFields,
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
  getFieldSuggestions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { query } = req.query;
    
    if (!query || (query as string).length < 2) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const suggestions = await FieldModel.getSuggestions(query as string);
    
    res.json({
      success: true,
      data: suggestions,
    });
  });

  // Get field by ID
  getField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { lat, lng } = req.query;

    const field = await FieldModel.findById(id);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    // Calculate distance if user location (lat/lng) is provided
    if (lat && lng && field.latitude && field.longitude) {
      const userLat = Number(lat);
      const userLng = Number(lng);

      // Haversine formula to calculate distance in miles
      const R = 3959; // Earth's radius in miles
      const dLat = (field.latitude - userLat) * Math.PI / 180;
      const dLng = (field.longitude - userLng) * Math.PI / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(field.latitude * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceMiles = R * c;

      // Add distanceMiles to field response
      (field as any).distanceMiles = Number(distanceMiles.toFixed(1));
    }

    // Enrich field with full amenity objects
    const enrichedField = await enrichFieldWithAmenities(field);

    res.json({
      success: true,
      data: enrichedField,
    });
  });

  // Get fields by owner
  getMyFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;

    const fields = await FieldModel.findByOwner(ownerId);

    // Enrich fields with full amenity objects
    const enrichedFields = await enrichFieldsWithAmenities(fields);

    res.json({
      success: true,
      data: enrichedFields,
      total: enrichedFields.length,
    });
  });

  // Update field
  updateField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check ownership
    const field = await FieldModel.findById(id);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    if (field.ownerId !== userId && userRole !== 'ADMIN') {
      throw new AppError('You can only update your own fields', 403);
    }

    // Prevent updating certain fields
    delete req.body.id;
    delete req.body.ownerId;

    // Convert amenity IDs to names if amenities are being updated
    if (req.body.amenities && req.body.amenities.length > 0) {
      req.body.amenities = await convertAmenityIdsToNames(req.body.amenities);
    }

    // Validate minimum operating hours if times are being updated
    if (req.body.openingTime || req.body.closingTime) {
      const settings = await prisma.systemSettings.findFirst();
      const minimumHours = settings?.minimumFieldOperatingHours || 4;
      
      // Get the current field data to merge with updates
      const openingTime = req.body.openingTime || field.openingTime;
      const closingTime = req.body.closingTime || field.closingTime;
      
      if (openingTime && closingTime) {
        const timeToMinutes = (timeStr: string): number => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + (minutes || 0);
        };
        
        const openingMinutes = timeToMinutes(openingTime);
        const closingMinutes = timeToMinutes(closingTime);
        const diffHours = (closingMinutes - openingMinutes) / 60;
        
        if (diffHours < 0) {
          throw new AppError('Closing time must be after opening time', 400);
        }
        
        if (diffHours < minimumHours) {
          throw new AppError(`Field must be open for at least ${minimumHours} hours`, 400);
        }
      }
    }

    const updatedField = await FieldModel.update(id, req.body);

    // Enrich field with full amenity objects
    const enrichedField = await enrichFieldWithAmenities(updatedField);

    res.json({
      success: true,
      message: 'Field updated successfully',
      data: enrichedField,
    });
  });

  // Delete field
  deleteField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check ownership
    const field = await FieldModel.findById(id);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    if (field.ownerId !== userId && userRole !== 'ADMIN') {
      throw new AppError('You can only delete your own fields', 403);
    }

    await FieldModel.delete(id);

    res.status(204).json({
      success: true,
      message: 'Field deleted successfully',
    });
  });

  // Toggle field active status
  toggleFieldStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Check ownership
    const field = await FieldModel.findById(id);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    if (field.ownerId !== userId && userRole !== 'ADMIN') {
      throw new AppError('You can only toggle your own fields', 403);
    }

    const updatedField = await FieldModel.toggleActive(id);

    // Enrich field with full amenity objects
    const enrichedField = await enrichFieldWithAmenities(updatedField);

    res.json({
      success: true,
      message: `Field ${updatedField.isActive ? 'activated' : 'deactivated'} successfully`,
      data: enrichedField,
    });
  });

  // Search fields by location
  searchByLocation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      throw new AppError('Latitude and longitude are required', 400);
    }

    const fields = await FieldModel.searchByLocation(
      Number(lat),
      Number(lng),
      Number(radius)
    );

    // Enrich fields with full amenity objects
    const enrichedFields = await enrichFieldsWithAmenities(fields);

    res.json({
      success: true,
      data: enrichedFields,
      total: enrichedFields.length,
    });
  });

  // Get nearby fields based on lat/lng
  getNearbyFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { lat, lng, radius = 10, page = 1, limit = 9 } = req.query;

    // Validate required parameters
    if (!lat || !lng) {
      throw new AppError('Latitude and longitude are required', 400);
    }

    // Validate lat/lng values
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new AppError('Invalid latitude or longitude values', 400);
    }

    if (latitude < -90 || latitude > 90) {
      throw new AppError('Latitude must be between -90 and 90', 400);
    }

    if (longitude < -180 || longitude > 180) {
      throw new AppError('Longitude must be between -180 and 180', 400);
    }

    const radiusNum = Number(radius);
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get all active fields with distance calculated
    const allFieldsWithDistance = await FieldModel.searchByLocation(
      latitude,
      longitude,
      999999 // Very large radius to get all fields
    );

    // Split into nearby and remaining fields
    const nearbyFields = allFieldsWithDistance.filter(
      (field: any) => field.distanceMiles <= radiusNum
    );
    const remainingFields = allFieldsWithDistance.filter(
      (field: any) => field.distanceMiles > radiusNum
    );

    // Combine: nearby fields first, then remaining fields
    const combinedFields = [...nearbyFields, ...remainingFields];

    // Apply pagination to combined results
    const total = combinedFields.length;
    const paginatedFields = combinedFields.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(total / limitNum);

    // Transform to optimized field card format
    const transformedFields = paginatedFields.map((field: any) => {
      // Handle both Prisma Json type and actual parsed object
      const locationData = typeof field.location === 'string'
        ? JSON.parse(field.location)
        : field.location;

      const fieldLat = locationData?.lat || field.latitude;
      const fieldLng = locationData?.lng || field.longitude;

      return {
        id: field.id,
        name: field.name,
        image: field.images?.[0] || null,
        price: field.price,
        duration: field.bookingDuration || 'hour',
        rating: field.averageRating || 0,
        reviewCount: field.totalReviews || 0,
        amenities: field.amenities?.slice(0, 4) || [],
        isClaimed: field.isClaimed,
        owner: field.ownerName || 'Field Owner',
        location: {
          address: field.address,
          city: field.city,
          state: field.state,
          zipCode: field.zipCode,
          lat: fieldLat,
          lng: fieldLng,
        },
        locationDisplay: [field.city, field.state].filter(Boolean).join(', '),
        distance: field.distanceMiles === Infinity ? null : field.distanceMiles,
        distanceDisplay: field.distanceMiles === Infinity
          ? 'Location not available'
          : field.distanceMiles < 1
          ? `${(field.distanceMiles * 1760).toFixed(0)} yards`
          : `${field.distanceMiles.toFixed(1)} miles`,
      };
    });

    // Enrich fields with amenity labels (string array only)
    const enrichedFields = await enrichFieldsWithAmenities(transformedFields);

    res.json({
      success: true,
      data: enrichedFields,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      metadata: {
        nearbyCount: nearbyFields.length,
        remainingCount: remainingFields.length,
        radius: radiusNum,
      },
    });
  });

  // Get popular fields based on highest rating and most bookings
  getPopularFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 12, lat, lng } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;
    const userLat = lat ? Number(lat) : null;
    const userLng = lng ? Number(lng) : null;

    // Get active fields with booking counts and ratings
    const fields = await prisma.field.findMany({
      where: {
        isActive: true,
        isSubmitted: true,
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        address: true,
        price: true,
        bookingDuration: true,
        averageRating: true,
        totalReviews: true,
        images: true,
        amenities: true,
        isClaimed: true,
        ownerName: true,
        latitude: true,
        longitude: true,
        location: true,
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  in: ['CONFIRMED', 'COMPLETED']
                }
              }
            },
          },
        },
      },
    });

    // Calculate popularity score and distance
    const fieldsWithScore = fields.map((field: any) => {
      const bookingCount = field._count.bookings || 0;
      const rating = field.averageRating || 0;
      const reviewCount = field.totalReviews || 0;

      // Popularity score formula: (rating * 0.4) + (bookingCount * 0.4) + (reviewCount * 0.2)
      // Normalize booking count (assuming max 100 bookings gives full score)
      const normalizedBookings = Math.min(bookingCount / 100, 1) * 5;
      // Normalize review count (assuming 50 reviews gives full score)
      const normalizedReviews = Math.min(reviewCount / 50, 1) * 5;

      const popularityScore = (rating * 0.4) + (normalizedBookings * 0.4) + (normalizedReviews * 0.2);

      // Calculate distance if user location is provided
      let distanceMiles = undefined;
      if (userLat !== null && userLng !== null && field.latitude && field.longitude) {
        const R = 3959; // Earth's radius in miles
        const dLat = (field.latitude - userLat) * Math.PI / 180;
        const dLng = (field.longitude - userLng) * Math.PI / 180;

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(userLat * Math.PI / 180) * Math.cos(field.latitude * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceMiles = Number((R * c).toFixed(1));
      }

      return {
        ...field,
        bookingCount,
        popularityScore,
        distanceMiles,
      };
    });

    // Sort by popularity score (highest first)
    fieldsWithScore.sort((a, b) => b.popularityScore - a.popularityScore);

    // Apply pagination
    const total = fieldsWithScore.length;
    const paginatedFields = fieldsWithScore.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(total / limitNum);

    // Transform to optimized field card format
    const transformedFields = paginatedFields.map((field: any) => {
      // Handle both Prisma Json type and actual parsed object
      const locationData = typeof field.location === 'string'
        ? JSON.parse(field.location)
        : field.location;

      const fieldLat = locationData?.lat || field.latitude;
      const fieldLng = locationData?.lng || field.longitude;

      return {
        id: field.id,
        name: field.name,
        image: field.images?.[0] || null,
        price: field.price,
        duration: field.bookingDuration || 'hour',
        rating: field.averageRating || 0,
        reviewCount: field.totalReviews || 0,
        amenities: field.amenities?.slice(0, 4) || [],
        isClaimed: field.isClaimed,
        owner: field.ownerName || 'Field Owner',
        location: {
          address: field.address,
          city: field.city,
          state: field.state,
          zipCode: field.zipCode,
          lat: fieldLat,
          lng: fieldLng,
        },
        locationDisplay: [field.city, field.state].filter(Boolean).join(', '),
        distance: field.distanceMiles,
        distanceDisplay: field.distanceMiles
          ? field.distanceMiles < 1
            ? `${(field.distanceMiles * 1760).toFixed(0)} yards`
            : `${field.distanceMiles.toFixed(1)} miles`
          : undefined,
      };
    });

    // Enrich fields with full amenity objects
    const enrichedFields = await enrichFieldsWithAmenities(transformedFields);

    res.json({
      success: true,
      data: enrichedFields,
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
  getOwnerField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;

    const field = await FieldModel.findOneByOwner(ownerId);

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

    // Enrich field with full amenity objects
    const enrichedField = await enrichFieldWithAmenities(field);

    // Return the field with step completion status
    res.json({
      success: true,
      field: {
        ...enrichedField,
        stepStatus: {
          fieldDetails: enrichedField.fieldDetailsCompleted || false,
          uploadImages: enrichedField.uploadImagesCompleted || false,
          pricingAvailability: enrichedField.pricingAvailabilityCompleted || false,
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
  saveFieldProgress = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const { step, data, fieldId: providedFieldId } = req.body;

    // Check if we're updating an existing field or creating a new one
    let fieldId: string;
    let isNewField = false;

    // If fieldId is provided, use it; otherwise find or create a field
    if (providedFieldId) {
      // Verify ownership
      const existingField = await FieldModel.findById(providedFieldId);
      if (!existingField || existingField.ownerId !== ownerId) {
        throw new AppError('Field not found or you do not have permission', 403);
      }
      fieldId = providedFieldId;
    } else {
      // No fieldId provided
      // For steps after field-details, try to find the most recent incomplete field
      // This handles cases where fieldId was lost due to page refresh or state issues
      if (step !== 'field-details') {
        const ownerFields = await FieldModel.findByOwner(ownerId);
        const incompleteField = ownerFields
          .filter((f: any) => !f.isSubmitted)
          .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

        if (incompleteField) {
          // Use the most recent incomplete field
          fieldId = incompleteField.id;
          console.log(`[SaveProgress] Using most recent incomplete field ${fieldId} for step ${step}`);
        } else {
          // No incomplete fields found - create a new one
          isNewField = true;
          console.log(`[SaveProgress] No incomplete field found. Creating new field for step ${step}`);
        }
      } else {
        // For field-details step, always create a new field when no fieldId is provided
        isNewField = true;
        console.log(`[SaveProgress] Creating new field for field-details step`);
      }

      // Only create a new field if we didn't find an incomplete one
      if (isNewField) {
        // Prepare initial field data based on the step
        let initialFieldData: any = {
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
          const settings = await prisma.systemSettings.findFirst();
          const minimumHours = settings?.minimumFieldOperatingHours || 4;
          
          const timeToMinutes = (timeStr: string): number => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + (minutes || 0);
          };
          
          const openingMinutes = timeToMinutes(data.startTime);
          const closingMinutes = timeToMinutes(data.endTime);
          const diffHours = (closingMinutes - openingMinutes) / 60;
          
          if (diffHours < 0) {
            throw new AppError('Closing time must be after opening time', 400);
          }
          
          if (diffHours < minimumHours) {
            throw new AppError(`Field must be open for at least ${minimumHours} hours`, 400);
          }
        }
        
        // Convert amenity IDs to names
        const amenityIds = data.amenities && Array.isArray(data.amenities)
          ? data.amenities
          : (typeof data.amenities === 'object'
            ? Object.keys(data.amenities || {}).filter(key => data.amenities[key])
            : []);
        const amenityNames = amenityIds.length > 0 ? await convertAmenityIdsToNames(amenityIds) : [];

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
          amenities: amenityNames,
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
        const newField = await FieldModel.create(initialFieldData);
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
    }

    let updateData: any = {};

    // Update based on which step is being saved
    switch(step) {
      case 'field-details':
        // Validate minimum operating hours
        if (data.startTime && data.endTime) {
          const settings = await prisma.systemSettings.findFirst();
          const minimumHours = settings?.minimumFieldOperatingHours || 4;
          
          const timeToMinutes = (timeStr: string): number => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + (minutes || 0);
          };
          
          const openingMinutes = timeToMinutes(data.startTime);
          const closingMinutes = timeToMinutes(data.endTime);
          const diffHours = (closingMinutes - openingMinutes) / 60;
          
          if (diffHours < 0) {
            throw new AppError('Closing time must be after opening time', 400);
          }
          
          if (diffHours < minimumHours) {
            throw new AppError(`Field must be open for at least ${minimumHours} hours`, 400);
          }
        }
        
        // Convert amenity IDs to names
        const amenityIdsUpdate = data.amenities && Array.isArray(data.amenities)
          ? data.amenities
          : (typeof data.amenities === 'object'
            ? Object.keys(data.amenities || {}).filter(key => data.amenities[key])
            : []);
        const amenityNamesUpdate = amenityIdsUpdate.length > 0 ? await convertAmenityIdsToNames(amenityIdsUpdate) : [];

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
          amenities: amenityNamesUpdate,
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
        // Get existing field to compare images
        let oldImages: string[] = [];
        if (!isNewField) {
          const existingField = await FieldModel.findById(fieldId);
          oldImages = existingField?.images || [];
        }

        const newImages = data.images || [];

        // Find images that were removed (exist in old but not in new)
        const imagesToDelete = oldImages.filter(oldUrl => !newImages.includes(oldUrl));

        // Delete removed images from S3
        if (imagesToDelete.length > 0) {
          console.log(`[SaveProgress] Deleting ${imagesToDelete.length} removed images`);
          for (const imageUrl of imagesToDelete) {
            try {
              // Extract key from URL
              let fileKey = '';
              const urlParts = imageUrl.split('.amazonaws.com/');
              if (urlParts.length > 1) {
                fileKey = urlParts[1];
              } else {
                const altParts = imageUrl.split(`/${process.env.AWS_S3_BUCKET}/`);
                if (altParts.length > 1) {
                  fileKey = altParts[1];
                }
              }

              if (fileKey) {
                const command = new DeleteObjectCommand({
                  Bucket: process.env.AWS_S3_BUCKET!,
                  Key: fileKey,
                });
                await s3Client.send(command);
                console.log(`[SaveProgress] Deleted image: ${fileKey}`);
              }
            } catch (error) {
              console.error(`[SaveProgress] Error deleting image ${imageUrl}:`, error);
              // Continue with other deletions even if one fails
            }
          }
        }

        // If this is a new field created from a non-field-details step,
        // we need to ensure basic field info exists
        if (isNewField) {
          updateData = {
            name: 'Untitled Field',
            type: 'PRIVATE',
            images: newImages,
            uploadImagesCompleted: true
          };
        } else {
          updateData = {
            images: newImages,
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
        } else {
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
        } else {
          updateData = {
            rules: data.rules ? [data.rules] : [],
            cancellationPolicy: data.policies || '',
            bookingRulesCompleted: true
          };
        }
        break;

      default:
        throw new AppError('Invalid step', 400);
    }

    // Update field
    const field = await FieldModel.update(fieldId, updateData);

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
  submitFieldForReview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const { fieldId } = req.body;

    // Get the field - use fieldId if provided, otherwise get first field
    let field;
    if (fieldId) {
      field = await FieldModel.findById(fieldId);
      // Verify ownership
      if (field && field.ownerId !== ownerId) {
        throw new AppError('You can only submit your own fields', 403);
      }
    } else {
      field = await FieldModel.findOneByOwner(ownerId);
    }

    if (!field) {
      throw new AppError('No field found for this owner', 404);
    }

    // Check if all steps are completed
    if (!field.fieldDetailsCompleted ||
        !field.uploadImagesCompleted ||
        !field.pricingAvailabilityCompleted ||
        !field.bookingRulesCompleted) {
      throw new AppError('Please complete all steps before submitting', 400);
    }

    // Submit the field
    const submittedField = await FieldModel.submitField(field.id);

    // Get field owner details for email and notification
    const fieldOwner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    if (fieldOwner) {
      // Send email to field owner
      const { emailService } = await import('../services/email.service');
      try {
        await emailService.sendFieldSubmissionEmail({
          email: fieldOwner.email,
          ownerName: fieldOwner.name || 'Field Owner',
          fieldName: submittedField.name || 'Your Field',
          fieldAddress: `${submittedField.address || ''}, ${submittedField.city || ''}, ${submittedField.state || ''}`.trim(),
          submittedAt: submittedField.submittedAt || new Date()
        });
      } catch (emailError) {
        console.error('Failed to send field submission email:', emailError);
        // Don't throw error - email failure shouldn't stop the submission
      }

      // Create notification for field owner
      const { NotificationService } = await import('../services/notification.service');
      try {
        await NotificationService.createNotification({
          userId: fieldOwner.id,
          type: 'field_submitted',
          title: 'Field Submitted Successfully',
          message: `Your field "${submittedField.name}" has been successfully submitted and is now live on Fieldsy!`,
          data: {
            fieldId: submittedField.id,
            fieldName: submittedField.name,
            submittedAt: submittedField.submittedAt
          }
        }, false); // Don't notify admin for user's own notification
      } catch (notificationError) {
        console.error('Failed to create field owner notification:', notificationError);
      }

      // Create notification for all admins
      try {
        await NotificationService.notifyAdmins(
          'New Field Submission',
          `Field owner ${fieldOwner.name} has submitted a new field: "${submittedField.name}" at ${submittedField.address}, ${submittedField.city}`,
          {
            fieldId: submittedField.id,
            fieldName: submittedField.name,
            ownerId: fieldOwner.id,
            ownerName: fieldOwner.name,
            submittedAt: submittedField.submittedAt
          }
        );
      } catch (adminNotificationError) {
        console.error('Failed to create admin notification:', adminNotificationError);
      }
    }

    res.json({
      success: true,
      message: 'Field submitted successfully!',
      data: submittedField
    });
  });

  // Get bookings for field owner's field
  getFieldBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const { status = 'all', page = 1, limit = 10 } = req.query;

    try {
      // First get all owner's fields
      const fields = await FieldModel.findByOwner(ownerId);

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
      const fieldIds = fields.map((field: any) => field.id);

      // Get bookings from database
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let bookingFilter: any = { fieldId: { in: fieldIds } };

      // Filter based on status
      if (status === 'today') {
        bookingFilter.date = {
          gte: today,
          lt: tomorrow
        };
      } else if (status === 'upcoming') {
        bookingFilter.date = {
          gte: tomorrow
        };
      } else if (status === 'previous') {
        bookingFilter.date = {
          lt: today
        };
      }

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      // Fetch bookings with user details and count
      const [bookings, totalFilteredBookings] = await Promise.all([
        prisma.booking.findMany({
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
        prisma.booking.count({ where: bookingFilter })
      ]);

      // Get overall stats across all fields
      const totalBookings = await prisma.booking.count({
        where: { fieldId: { in: fieldIds } }
      });

      const todayBookings = await prisma.booking.count({
        where: {
          fieldId: { in: fieldIds },
          date: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      const totalEarnings = await prisma.booking.aggregate({
        where: {
          fieldId: { in: fieldIds },
          status: 'COMPLETED'
        },
        _sum: {
          fieldOwnerAmount: true
        }
      });

      // Format bookings for frontend
      const formattedBookings = bookings.map((booking: any) => ({
        id: booking.id,
        userName: booking.user.name,
        userAvatar: booking.user.image || booking.user.googleImage || null,
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
          totalEarnings: totalEarnings._sum.fieldOwnerAmount || 0
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
    } catch (error) {
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
  getTodayBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const { page = 1, limit = 12 } = req.query;

    try {
      // First get all owner's fields
      const fields = await FieldModel.findByOwner(ownerId);

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
      const fieldIds = fields.map((field: any) => field.id);

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
        prisma.booking.findMany({
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
        prisma.booking.count({ where: bookingFilter })
      ]);

      // Get overall stats across all fields
      const [totalBookings, totalEarnings] = await Promise.all([
        prisma.booking.count({ where: { fieldId: { in: fieldIds } } }),
        prisma.booking.aggregate({
          where: {
            fieldId: { in: fieldIds },
            status: 'COMPLETED'
          },
          _sum: {
            fieldOwnerAmount: true
          }
        })
      ]);

      // Format bookings for frontend
      const formattedBookings = bookings.map((booking: any) => ({
        id: booking.id,
        userId: booking.user.id,
        userName: booking.user.name,
        userAvatar: booking.user.image || booking.user.googleImage || null,
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
        notes: booking.notes || null,
        rescheduleCount: booking.rescheduleCount || 0
      }));

      res.status(200).json({
        success: true,
        bookings: formattedBookings,
        stats: {
          todayBookings: totalFilteredBookings,
          totalBookings,
          totalEarnings: totalEarnings._sum.fieldOwnerAmount || 0
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
    } catch (error) {
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
  getUpcomingBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const { page = 1, limit = 12 } = req.query;

    try {
      // First get all owner's fields
      const fields = await FieldModel.findByOwner(ownerId);

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
      const fieldIds = fields.map((field: any) => field.id);

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
        prisma.booking.findMany({
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
        prisma.booking.count({ where: bookingFilter })
      ]);

      // Get overall stats across all fields
      const [totalBookings, todayBookings, totalEarnings] = await Promise.all([
        prisma.booking.count({ where: { fieldId: { in: fieldIds } } }),
        prisma.booking.count({
          where: {
            fieldId: { in: fieldIds },
            date: {
              gte: today,
              lt: tomorrow
            }
          }
        }),
        prisma.booking.aggregate({
          where: {
            fieldId: { in: fieldIds },
            status: 'COMPLETED'
          },
          _sum: {
            fieldOwnerAmount: true
          }
        })
      ]);

      // Format bookings for frontend
      const formattedBookings = bookings.map((booking: any) => ({
        id: booking.id,
        userId: booking.user.id,
        userName: booking.user.name,
        userAvatar: booking.user.image || booking.user.googleImage || null,
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
        notes: booking.notes || null,
        rescheduleCount: booking.rescheduleCount || 0
      }));

      res.status(200).json({
        success: true,
        bookings: formattedBookings,
        stats: {
          todayBookings,
          totalBookings,
          totalEarnings: totalEarnings._sum.fieldOwnerAmount || 0
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
    } catch (error) {
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
  getPreviousBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const { page = 1, limit = 12 } = req.query;

    try {
      // First get all owner's fields
      const fields = await FieldModel.findByOwner(ownerId);

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
      const fieldIds = fields.map((field: any) => field.id);

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
        prisma.booking.findMany({
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
        prisma.booking.count({ where: bookingFilter })
      ]);

      // Get overall stats across all fields
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [totalBookings, todayBookings, totalEarnings] = await Promise.all([
        prisma.booking.count({ where: { fieldId: { in: fieldIds } } }),
        prisma.booking.count({
          where: {
            fieldId: { in: fieldIds },
            date: {
              gte: today,
              lt: tomorrow
            }
          }
        }),
        prisma.booking.aggregate({
          where: {
            fieldId: { in: fieldIds },
            status: 'COMPLETED'
          },
          _sum: {
            fieldOwnerAmount: true
          }
        })
      ]);

      // Format bookings for frontend
      const formattedBookings = bookings.map((booking: any) => ({
        id: booking.id,
        userId: booking.user.id,
        userName: booking.user.name,
        userAvatar: booking.user.image || booking.user.googleImage || null,
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
        notes: booking.notes || null,
        rescheduleCount: booking.rescheduleCount || 0
      }));

      res.status(200).json({
        success: true,
        bookings: formattedBookings,
        stats: {
          todayBookings,
          totalBookings,
          totalEarnings: totalEarnings._sum.fieldOwnerAmount || 0
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
    } catch (error) {
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
  getRecentBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const ownerId = (req as any).user.id;
    const { limit = 5 } = req.query;
    const limitNum = Number(limit);

    try {
      // First get the owner's field
      const fields = await FieldModel.findByOwner(ownerId);
      
      if (!fields || fields.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No field found for this owner',
          bookings: []
        });
      }

      const fieldId = fields[0].id;

      // Get recent bookings
      const bookings = await prisma.booking.findMany({
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
        rescheduleCount: booking.rescheduleCount || 0,
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

    } catch (error) {
      console.error('Error fetching recent bookings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch recent bookings',
        bookings: []
      });
    }
  });

  // Get fields available for claiming
  getFieldForClaim = asyncHandler(async (req: Request, res: Response) => {
    const fields = await prisma.field.findMany({
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
  claimField = asyncHandler(async (req: Request, res: Response) => {
    const { fieldId } = req.body;
    const userId = (req as any).user.id;

    if (!fieldId) {
      return res.status(400).json({
        success: false,
        message: 'Field ID is required'
      });
    }

    // Check if field exists and is not already claimed
    const field = await prisma.field.findUnique({
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
    const updatedField = await prisma.field.update({
      where: { id: fieldId },
      data: {
        isClaimed: true,
        ownerId: userId,
        ownerName: (req as any).user.name || (req as any).user.email,
        joinedOn: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Field claimed successfully',
      data: updatedField
    });
  });

  // Approve field (Admin only)
  approveField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fieldId } = req.params;
    const adminId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Only admins can approve fields
    if (userRole !== 'ADMIN') {
      throw new AppError('Only admins can approve fields', 403);
    }

    // Get field details
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: {
        owner: true
      }
    });

    if (!field) {
      throw new AppError('Field not found', 404);
    }

    // Check if field is already approved
    if (field.isApproved) {
      throw new AppError('Field is already approved', 400);
    }

    // Update field approval status
    const approvedField = await prisma.field.update({
      where: { id: fieldId },
      data: {
        isApproved: true,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: adminId,
        isActive: true // Make field active when approved
      }
    });

    // Create notification for field owner
    await prisma.notification.create({
      data: {
        userId: field.ownerId,
        type: 'field_approved',
        title: 'Field Approved!',
        message: `Your field "${field.name}" has been approved and is now live on Fieldsy.`,
        data: {
          fieldId: field.id,
          fieldName: field.name
        }
      }
    });

    // Send approval email to field owner
    try {
      const { emailService } = await import('../services/email.service');

      // Get field address
      let fieldAddress = '';
      if (field.location && typeof field.location === 'object') {
        const loc = field.location as any;
        fieldAddress = loc.formatted_address || loc.streetAddress || field.address || '';
      } else {
        fieldAddress = field.address || '';
      }

      await emailService.sendFieldApprovalEmail({
        email: field.owner.email,
        ownerName: field.owner.name || field.owner.email,
        fieldName: field.name || 'Your Field',
        fieldAddress: fieldAddress,
        approvedAt: new Date()
      });
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the approval if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Field approved successfully and owner notified',
      data: approvedField
    });
  });

  // Reject field (Admin only)
  rejectField = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fieldId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Only admins can reject fields
    if (userRole !== 'ADMIN') {
      throw new AppError('Only admins can reject fields', 403);
    }

    // Get field details
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: {
        owner: true
      }
    });

    if (!field) {
      throw new AppError('Field not found', 404);
    }

    // Update field rejection status
    const rejectedField = await prisma.field.update({
      where: { id: fieldId },
      data: {
        isApproved: false,
        approvalStatus: 'REJECTED',
        rejectionReason: rejectionReason || 'Field did not meet our approval criteria',
        isActive: false // Deactivate rejected fields
      }
    });

    // Create notification for field owner
    await prisma.notification.create({
      data: {
        userId: field.ownerId,
        type: 'field_rejected',
        title: 'Field Submission Update',
        message: `Your field "${field.name}" submission requires attention. ${rejectionReason || 'Please check the details and resubmit.'}`,
        data: {
          fieldId: field.id,
          fieldName: field.name,
          rejectionReason: rejectionReason
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Field rejected and owner notified',
      data: rejectedField
    });
  });

  // Get fields pending approval (Admin only)
  getPendingFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user.role;
    const { page = 1, limit = 10 } = req.query;

    // Only admins can view pending fields
    if (userRole !== 'ADMIN') {
      throw new AppError('Only admins can view pending fields', 403);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [fields, total] = await Promise.all([
      prisma.field.findMany({
        where: {
          isSubmitted: true,
          approvalStatus: 'PENDING'
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        },
        skip,
        take: limitNum,
        orderBy: {
          submittedAt: 'desc'
        }
      }),
      prisma.field.count({
        where: {
          isSubmitted: true,
          approvalStatus: 'PENDING'
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: fields,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum
      }
    });
  });
}

export default new FieldController();
