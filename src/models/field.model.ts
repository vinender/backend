//@ts-nocheck
import prisma from '../config/database';
import { 
  isValidUKPostcode, 
  formatUKPostcode, 
  isPartialPostcode,
  getPostcodeOutwardCode,
  getPostcodeDistrict,
  getPostcodeArea 
} from '../utils/postcode.utils';

export interface CreateFieldInput {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  ownerId: string;
  type?: 'PRIVATE' | 'PUBLIC' | 'TRAINING';
  size?: string;
  terrainType?: string;
  price?: number;
  bookingDuration?: string;
  amenities?: string[];
  rules?: string[];
  images?: string[];
  maxDogs?: number;
  numberOfDogs?: number;
  openingTime?: string;
  closingTime?: string;
  operatingDays?: string[];
  instantBooking?: boolean;
  cancellationPolicy?: string;
  fieldFeatures?: any;
  fieldDetailsCompleted?: boolean;
  uploadImagesCompleted?: boolean;
  pricingAvailabilityCompleted?: boolean;
  bookingRulesCompleted?: boolean;
  isSubmitted?: boolean;
  submittedAt?: Date;
  isClaimed?: boolean;
  ownerName?: string;
  joinedOn?: string;
}

class FieldModel {
  // Create a new field
  async create(data: CreateFieldInput) {
    // Get owner details if not provided
    let ownerName = data.ownerName;
    let joinedOn = data.joinedOn;
    
    if ((!ownerName || !joinedOn) && data.ownerId) {
      const owner = await prisma.user.findUnique({
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
    const { apartment, ...cleanedData } = data as any;
    
    return prisma.field.create({
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
  async findById(id: string) {
    return prisma.field.findUnique({
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
  async findAll(filters: {
    search?: string;
    zipCode?: string;
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
    amenities?: string[];
    minRating?: number;
    maxDistance?: number;
    date?: Date;
    startTime?: string;
    endTime?: string;
    numberOfDogs?: number;
    size?: string;
    terrainType?: string;
    fenceType?: string;
    instantBooking?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    skip?: number;
    take?: number;
  }) {
    const { skip = 0, take = 10, sortBy = 'createdAt', sortOrder = 'desc', ...where } = filters;

    const whereClause: any = {
      isActive: true,
      isSubmitted: true,
    };

    // Exclude fields from blocked field owners
    const blockedOwners = await prisma.user.findMany({
      where: {
        role: 'FIELD_OWNER',
        isBlocked: true
      },
      select: { id: true }
    });

    if (blockedOwners.length > 0) {
      whereClause.ownerId = {
        notIn: blockedOwners.map(owner => owner.id)
      };
    }

    // Handle comprehensive search (field name, address, city, state, zipCode)
    if (where.search) {
      // Check if search term might be a UK postcode
      const isPostcode = isValidUKPostcode(where.search) || isPartialPostcode(where.search);
      
      if (isPostcode) {
        // If it's a postcode, search for matching postcodes
        const formattedPostcode = formatUKPostcode(where.search);
        const searchConditions: any[] = [];
        
        // Search for exact match (formatted)
        if (formattedPostcode) {
          searchConditions.push({ zipCode: formattedPostcode });
          searchConditions.push({ zipCode: formattedPostcode.replace(' ', '') });
        }
        
        // Search for partial matches (outward code, district, area)
        if (isPartialPostcode(where.search)) {
          const searchUpper = where.search.toUpperCase().trim();
          
          // Starts with partial postcode
          searchConditions.push({ 
            zipCode: { 
              startsWith: searchUpper,
              mode: 'insensitive' 
            } 
          });
          
          // Contains partial postcode (for formatted postcodes with space)
          searchConditions.push({ 
            zipCode: { 
              contains: searchUpper,
              mode: 'insensitive' 
            } 
          });
        }
        
        whereClause.OR = searchConditions;
      } else {
        // Regular search for non-postcode terms
        whereClause.OR = [
          { name: { contains: where.search, mode: 'insensitive' } },
          { description: { contains: where.search, mode: 'insensitive' } },
          { address: { contains: where.search, mode: 'insensitive' } },
          { city: { contains: where.search, mode: 'insensitive' } },
          { state: { contains: where.search, mode: 'insensitive' } },
          { zipCode: { contains: where.search, mode: 'insensitive' } },
        ];
      }
    }

    // Handle specific postal code search
    if (where.zipCode) {
      // Check if it's a UK postcode format
      const isUKPostcode = isValidUKPostcode(where.zipCode) || isPartialPostcode(where.zipCode);
      
      if (isUKPostcode) {
        const formattedPostcode = formatUKPostcode(where.zipCode);
        
        if (formattedPostcode) {
          // Search for exact match (both with and without space)
          whereClause.OR = [
            { zipCode: formattedPostcode },
            { zipCode: formattedPostcode.replace(' ', '') }
          ];
        } else if (isPartialPostcode(where.zipCode)) {
          // For partial postcodes, search for fields that start with this pattern
          const searchUpper = where.zipCode.toUpperCase().trim();
          whereClause.zipCode = {
            startsWith: searchUpper,
            mode: 'insensitive'
          };
        }
      } else {
        // Regular zipCode search for non-UK formats
        whereClause.zipCode = where.zipCode;
      }
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

    if (where.city) whereClause.city = where.city;
    if (where.state) whereClause.state = where.state;
    if (where.type) whereClause.type = where.type;
    
    // Price filter
    if (where.minPrice || where.maxPrice) {
      whereClause.price = {};
      if (where.minPrice) whereClause.price.gte = where.minPrice;
      if (where.maxPrice) whereClause.price.lte = where.maxPrice;
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
      prisma.field.findMany({
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
      prisma.field.count({ where: whereClause }),
    ]);

    return {
      fields,
      total,
      hasMore: skip + take < total,
    };
  }

  // Find all fields with filters (legacy - for backward compatibility)
  async findAllLegacy(filters: {
    city?: string;
    state?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
    skip?: number;
    take?: number;
  }) {
    const { skip = 0, take = 10, ...where } = filters;

    const whereClause: any = {
      isActive: true,
    };

    if (where.city) whereClause.city = where.city;
    if (where.state) whereClause.state = where.state;
    if (where.type) whereClause.type = where.type;
    if (where.minPrice || where.maxPrice) {
      whereClause.price = {};
      if (where.minPrice) whereClause.price.gte = where.minPrice;
      if (where.maxPrice) whereClause.price.lte = where.maxPrice;
    }

    return prisma.field.findMany({
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
  async findByOwner(ownerId: string) {
    return prisma.field.findMany({
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
  async findOneByOwner(ownerId: string) {
    return prisma.field.findFirst({
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
  async update(id: string, data: Partial<CreateFieldInput>) {
    // Remove apartment field as it doesn't exist in the schema
    const { apartment, ...dataWithoutApartment } = data as any;
    
    // If updating owner, also update owner name and joined date
    let updateData: any = { ...dataWithoutApartment };
    
    if (data.ownerId && (!data.ownerName || !data.joinedOn)) {
      const owner = await prisma.user.findUnique({
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
    
    return prisma.field.update({
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
  async updateStepCompletion(id: string, step: string, completed: boolean = true) {
    const stepField = `${step}Completed`;
    return prisma.field.update({
      where: { id },
      data: {
        [stepField]: completed,
      },
    });
  }

  // Submit field for review
  async submitField(id: string) {
    return prisma.field.update({
      where: { id },
      data: {
        isSubmitted: true,
        submittedAt: new Date(),
        isActive: true, // Activate field on submission
      },
    });
  }

  // Delete field
  async delete(id: string) {
    return prisma.field.delete({
      where: { id },
    });
  }

  // Toggle field active status
  async toggleActive(id: string) {
    const field = await prisma.field.findUnique({
      where: { id },
      select: { isActive: true },
    });

    return prisma.field.update({
      where: { id },
      data: { isActive: !field?.isActive },
    });
  }

  // Get field suggestions for autocomplete
  async getSuggestions(query: string) {
    const whereClause: any = {
      isActive: true,
      isSubmitted: true,
    };

    // Check if query might be a UK postcode
    const isPostcode = isValidUKPostcode(query) || isPartialPostcode(query);
    
    if (isPostcode) {
      // For postcode searches, look for matching postcodes
      const formattedPostcode = formatUKPostcode(query);
      const searchConditions: any[] = [];
      
      if (formattedPostcode) {
        searchConditions.push({ zipCode: formattedPostcode });
        searchConditions.push({ zipCode: formattedPostcode.replace(' ', '') });
      }
      
      if (isPartialPostcode(query)) {
        const searchUpper = query.toUpperCase().trim();
        searchConditions.push({ 
          zipCode: { 
            startsWith: searchUpper,
            mode: 'insensitive' 
          } 
        });
      }
      
      whereClause.OR = searchConditions;
    } else {
      // Comprehensive search by field name, address, city, state, or postal code
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
        { city: { contains: query, mode: 'insensitive' } },
        { state: { contains: query, mode: 'insensitive' } },
        { zipCode: { contains: query, mode: 'insensitive' } },
      ];
    }

    const fields = await prisma.field.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        zipCode: true,
        address: true,
        price: true,
        bookingDuration: true,
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
      price: field.price,
      rating: field.averageRating,
      reviews: field.totalReviews,
      image: field.images?.[0] || null,
    }));
  }

  // Search fields by location
  async searchByLocation(lat: number, lng: number, radius: number = 10) {
    // This is a simplified version. In production, you'd use PostGIS or similar
    // for proper geospatial queries
    return prisma.field.findMany({
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
  private buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc') {
    const orderByOptions: Record<string, any> = {
      price: { price: sortOrder },
      rating: { averageRating: sortOrder },
      reviews: { totalReviews: sortOrder },
      name: { name: sortOrder },
      createdAt: { createdAt: sortOrder },
      distance: { createdAt: sortOrder }, // Would need geospatial calculation
    };

    return orderByOptions[sortBy] || { createdAt: 'desc' };
  }
}

export default new FieldModel();
