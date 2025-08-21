import { Request, Response, NextFunction } from 'express';
import BookingModel from '../models/booking.model';
import FieldModel from '../models/field.model';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import prisma from '../config/database';
import { createNotification } from './notification.controller';

class BookingController {
  // Create a new booking
  createBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dogOwnerId = (req as any).user.id;
    const { fieldId, date, startTime, endTime, notes } = req.body;

    // Verify field exists and is active
    const field = await FieldModel.findById(fieldId);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    if (!field.isActive) {
      throw new AppError('Field is not available for booking', 400);
    }

    // Check availability
    const isAvailable = await BookingModel.checkAvailability(
      fieldId,
      new Date(date),
      startTime,
      endTime
    );

    if (!isAvailable) {
      throw new AppError('This time slot is not available', 400);
    }

    // Calculate total price based on duration
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    const durationHours = (endMinutes - startMinutes) / 60;
    const totalPrice = field.pricePerHour.toNumber() * durationHours;

    // Create booking
    const booking = await BookingModel.create({
      dogOwnerId,
      fieldId,
      date: new Date(date),
      startTime,
      endTime,
      totalPrice,
      notes,
    });

    // Send notification to field owner (if not booking their own field)
    if (field.ownerId && field.ownerId !== dogOwnerId) {
      await createNotification({
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
          dogOwnerName: (req as any).user.name,
        },
      });
    }

    // Send confirmation notification to dog owner
    await createNotification({
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

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  });

  // Get all bookings (admin only)
  getAllBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
      dogOwnerId,
      fieldId,
      status,
      date,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const bookings = await BookingModel.findAll({
      dogOwnerId: dogOwnerId as string,
      fieldId: fieldId as string,
      status: status as any,
      date: date ? new Date(date as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
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
  getBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const booking = await BookingModel.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Check access rights
    const hasAccess = 
      userRole === 'ADMIN' ||
      booking.dogOwnerId === userId ||
      (booking.field as any).ownerId === userId;

    if (!hasAccess) {
      throw new AppError('You do not have access to this booking', 403);
    }

    res.json({
      success: true,
      data: booking,
    });
  });

  // Get user's bookings with pagination
  getMyBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { status, page = 1, limit = 10 } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    let whereClause: any = {};
    
    if (userRole === 'DOG_OWNER') {
      whereClause.userId = userId;
    } else if (userRole === 'FIELD_OWNER') {
      // For field owner, we need to get their field first
      const fields = await prisma.field.findMany({
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
    } else {
      throw new AppError('Invalid user role', 400);
    }

    // Add status filter if provided
    if (status) {
      whereClause.status = status as string;
    }

    // Get bookings with pagination
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
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
      prisma.booking.count({ where: whereClause }),
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
  updateBookingStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const booking = await BookingModel.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Check authorization
    const isFieldOwner = (booking.field as any).ownerId === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isFieldOwner && !isAdmin) {
      throw new AppError('You are not authorized to update this booking', 403);
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[booking.status].includes(status)) {
      throw new AppError(`Cannot change status from ${booking.status} to ${status}`, 400);
    }

    const updatedBooking = await BookingModel.updateStatus(id, status);

    // Send notifications based on status change
    const field = (booking.field as any);
    
    if (status === 'CONFIRMED') {
      // Notify dog owner that booking is confirmed
      await createNotification({
        userId: booking.dogOwnerId,
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
    } else if (status === 'COMPLETED') {
      // Notify dog owner that booking is completed
      await createNotification({
        userId: booking.dogOwnerId,
        type: 'booking_completed',
        title: 'Booking Completed',
        message: `We hope you enjoyed your visit to ${field.name}. Consider leaving a review!`,
        data: {
          bookingId: booking.id,
          fieldId: field.id,
          fieldName: field.name,
        },
      });
    }

    res.json({
      success: true,
      message: `Booking ${status.toLowerCase()} successfully`,
      data: updatedBooking,
    });
  });

  // Cancel booking (dog owner or field owner)
  cancelBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const booking = await BookingModel.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Check authorization
    const isDogOwner = booking.dogOwnerId === userId;
    const isFieldOwner = (booking.field as any).ownerId === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isDogOwner && !isFieldOwner && !isAdmin) {
      throw new AppError('You are not authorized to cancel this booking', 403);
    }

    // Check if booking can be cancelled
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      throw new AppError(`Cannot cancel a ${booking.status.toLowerCase()} booking`, 400);
    }

    // Check cancellation policy (e.g., 24 hours before booking)
    const bookingDate = new Date(booking.date);
    const now = new Date();
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 24 && !isAdmin) {
      throw new AppError('Bookings can only be cancelled 24 hours in advance', 400);
    }

    const cancelledBooking = await BookingModel.cancel(id);

    // Send cancellation notifications
    const field = (booking.field as any);
    
    if (isDogOwner) {
      // Dog owner cancelled - notify field owner
      if (field.ownerId) {
        await createNotification({
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
      }
      
      // Send confirmation to dog owner
      await createNotification({
        userId: booking.dogOwnerId,
        type: 'booking_cancelled_success',
        title: 'Booking Cancelled',
        message: `Your booking for ${field.name} on ${new Date(booking.date).toLocaleDateString()} has been cancelled successfully.`,
        data: {
          bookingId: booking.id,
          fieldId: field.id,
          fieldName: field.name,
        },
      });
    } else if (isFieldOwner) {
      // Field owner cancelled - notify dog owner
      await createNotification({
        userId: booking.dogOwnerId,
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
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: cancelledBooking,
    });
  });

  // Update booking (reschedule)
  updateBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { date, startTime, endTime, notes } = req.body;
    const userId = (req as any).user.id;

    const booking = await BookingModel.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Only dog owner can reschedule their booking
    if (booking.dogOwnerId !== userId) {
      throw new AppError('You can only update your own bookings', 403);
    }

    // Check if booking can be rescheduled
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      throw new AppError('Only pending or confirmed bookings can be rescheduled', 400);
    }

    // If changing time/date, check availability
    if (date || startTime || endTime) {
      const newDate = date ? new Date(date) : booking.date;
      const newStartTime = startTime || booking.startTime;
      const newEndTime = endTime || booking.endTime;

      const isAvailable = await BookingModel.checkAvailability(
        booking.fieldId,
        newDate,
        newStartTime,
        newEndTime,
        id // Exclude current booking from check
      );

      if (!isAvailable) {
        throw new AppError('The new time slot is not available', 400);
      }

      // Recalculate price if time changed
      if (startTime || endTime) {
        const field = await FieldModel.findById(booking.fieldId);
        const startMinutes = this.timeToMinutes(newStartTime);
        const endMinutes = this.timeToMinutes(newEndTime);
        const durationHours = (endMinutes - startMinutes) / 60;
        const totalPrice = field!.pricePerHour.toNumber() * durationHours;

        req.body.totalPrice = totalPrice;
      }
    }

    const updatedBooking = await BookingModel.update(id, req.body);

    res.json({
      success: true,
      message: 'Booking updated successfully',
      data: updatedBooking,
    });
  });

  // Delete booking (admin only)
  deleteBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const booking = await BookingModel.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    await BookingModel.delete(id);

    res.status(204).json({
      success: true,
      message: 'Booking deleted successfully',
    });
  });

  // Get booking statistics
  getBookingStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    let stats;
    if (userRole === 'DOG_OWNER') {
      stats = await BookingModel.getDogOwnerStats(userId);
    } else if (userRole === 'FIELD_OWNER') {
      stats = await BookingModel.getFieldOwnerStats(userId);
    } else {
      throw new AppError('Statistics not available for this user role', 400);
    }

    res.json({
      success: true,
      data: stats,
    });
  });

  // Check field availability
  checkAvailability = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fieldId, date, startTime, endTime } = req.query;

    if (!fieldId || !date || !startTime || !endTime) {
      throw new AppError('Field ID, date, start time, and end time are required', 400);
    }

    const isAvailable = await BookingModel.checkAvailability(
      fieldId as string,
      new Date(date as string),
      startTime as string,
      endTime as string
    );

    res.json({
      success: true,
      available: isAvailable,
    });
  });

  // Helper function
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

export default new BookingController();