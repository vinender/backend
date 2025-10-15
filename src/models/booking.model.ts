//@ts-nocheck
import { PrismaClient, Booking, BookingStatus, Prisma } from '@prisma/client';
import prisma from '../config/database';

interface CreateBookingInput {
  dogOwnerId: string;
  fieldId: string;
  date: Date;
  startTime: string;
  endTime: string;
  timeSlot?: string;
  totalPrice: number;
  numberOfDogs?: number;
  notes?: string;
}

interface BookingFilters {
  dogOwnerId?: string;
  fieldId?: string;
  status?: BookingStatus;
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  skip?: number;
  take?: number;
}

class BookingModel {
  // Create a new booking
  async create(data: CreateBookingInput): Promise<Booking> {
    const { dogOwnerId, ...rest } = data;

    // Get field data for snapshot
    const field = await prisma.field.findUnique({
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

    return prisma.booking.create({
      data: {
        ...rest,
        userId: dogOwnerId,
        status: 'PENDING'
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
  async findById(id: string): Promise<Booking | null> {
    return prisma.booking.findUnique({
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
  async findAll(filters: BookingFilters = {}): Promise<Booking[]> {
    const where: Prisma.BookingWhereInput = {};

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

    return prisma.booking.findMany({
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
  async findByDogOwner(dogOwnerId: string): Promise<Booking[]> {
    return this.findAll({ dogOwnerId });
  }

  // Find bookings by field
  async findByField(fieldId: string): Promise<Booking[]> {
    return this.findAll({ fieldId });
  }

  // Find bookings by field owner
  async findByFieldOwner(ownerId: string): Promise<Booking[]> {
    return prisma.booking.findMany({
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
  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    return prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        field: true,
        user: true,
      },
    });
  }

  // Update booking
  async update(id: string, data: any): Promise<Booking> {
    return prisma.booking.update({
      where: { id },
      data,
      include: {
        field: true,
        user: true,
      },
    });
  }

  // Cancel booking
  async cancel(id: string, reason?: string): Promise<Booking> {
    return prisma.booking.update({
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
  async complete(id: string): Promise<Booking> {
    return this.updateStatus(id, 'COMPLETED');
  }

  // Delete booking
  async delete(id: string): Promise<void> {
    await prisma.booking.delete({
      where: { id },
    });
  }

  // Check availability for a field on a specific date and time
  async checkAvailability(
    fieldId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    const where: Prisma.BookingWhereInput = {
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

    const conflictingBookings = await prisma.booking.findMany({
      where,
    });

    // Check for time conflicts
    for (const booking of conflictingBookings) {
      const bookingStart = this.timeToMinutes(booking.startTime);
      const bookingEnd = this.timeToMinutes(booking.endTime);
      const requestedStart = this.timeToMinutes(startTime);
      const requestedEnd = this.timeToMinutes(endTime);

      // Check if times overlap
      if (
        (requestedStart >= bookingStart && requestedStart < bookingEnd) ||
        (requestedEnd > bookingStart && requestedEnd <= bookingEnd) ||
        (requestedStart <= bookingStart && requestedEnd >= bookingEnd)
      ) {
        return false; // Time conflict found
      }
    }

    return true; // No conflicts
  }

  // Helper function to convert time string to minutes
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Get booking statistics for a field owner
  async getFieldOwnerStats(ownerId: string) {
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
  async getDogOwnerStats(dogOwnerId: string) {
    const bookings = await this.findByDogOwner(dogOwnerId);
    
    const stats = {
      total: bookings.length,
      upcoming: bookings.filter(b => 
        b.status === 'CONFIRMED' && new Date(b.date) >= new Date()
      ).length,
      completed: bookings.filter(b => b.status === 'COMPLETED').length,
      cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
      totalSpent: bookings
        .filter(b => b.status === 'COMPLETED')
        .reduce((sum, b) => sum + b.totalPrice, 0),
    };

    return stats;
  }
}

export default new BookingModel();
