import prisma from '../config/database';

export interface CreateFieldInput {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  ownerId: string;
  type?: 'PRIVATE' | 'PUBLIC' | 'TRAINING';
  size?: string;
  terrainType?: string;
  pricePerHour?: number;
  pricePerDay?: number;
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
}

class FieldModel {
  // Create a new field
  async create(data: CreateFieldInput) {
    return prisma.field.create({
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
      whereClause.pricePerHour = {};
      if (where.minPrice) whereClause.pricePerHour.gte = where.minPrice;
      if (where.maxPrice) whereClause.pricePerHour.lte = where.maxPrice;
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
        orderBy: {
          createdAt: 'desc',
        },
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
      whereClause.pricePerHour = {};
      if (where.minPrice) whereClause.pricePerHour.gte = where.minPrice;
      if (where.maxPrice) whereClause.pricePerHour.lte = where.maxPrice;
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
    return prisma.field.update({
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
}

export default new FieldModel();