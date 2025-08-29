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
    const { fieldId, date, startTime, endTime, notes, numberOfDogs = 1 } = req.body;

    // Verify field exists and is active
    const field = await FieldModel.findById(fieldId);
    if (!field) {
      throw new AppError('Field not found', 404);
    }

    if (!field.isActive) {
      throw new AppError('Field is not available for booking', 400);
    }

    // Check if the time slot is in the past
    const bookingDate = new Date(date);
    const [startHourStr, startPeriod] = startTime.split(/(?=[AP]M)/);
    let startHour = parseInt(startHourStr.split(':')[0]);
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    
    const slotDateTime = new Date(bookingDate);
    slotDateTime.setHours(startHour, parseInt(startHourStr.split(':')[1] || '0'), 0, 0);
    
    if (slotDateTime < new Date()) {
      throw new AppError('Cannot book a time slot in the past', 400);
    }

    // Check dog limit for this slot
    const maxDogsPerSlot = (field as any).maxDogs || 10;
    
    // Get existing bookings for this slot
    const startOfDayDate = new Date(bookingDate);
    startOfDayDate.setHours(0, 0, 0, 0);
    
    const endOfDayDate = new Date(bookingDate);
    endOfDayDate.setHours(23, 59, 59, 999);
    
    const existingBookings = await prisma.booking.findMany({
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

    const totalDogsBooked = existingBookings.reduce((total, booking) => total + booking.numberOfDogs, 0);
    const availableSpots = maxDogsPerSlot - totalDogsBooked;

    if (numberOfDogs > availableSpots) {
      throw new AppError(
        `Only ${availableSpots} spots available for this time slot. Maximum capacity is ${maxDogsPerSlot} dogs.`,
        400
      );
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

    // Calculate total price based on duration and number of dogs
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    const durationHours = (endMinutes - startMinutes) / 60;
    const pricePerHour = field.pricePerHour?.toNumber() || field.price || 0;
    const totalPrice = pricePerHour * durationHours * numberOfDogs;

    // Create booking
    const booking = await BookingModel.create({
      dogOwnerId,
      fieldId,
      date: new Date(date),
      startTime,
      endTime,
      totalPrice,
      numberOfDogs, // Store number of dogs with the booking
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
        console.log('Field owner notification sent successfully');
      } catch (error) {
        console.error('Failed to send field owner notification:', error);
      }
    } else {
      console.log('Skipping field owner notification - booking own field');
    }

    // Send confirmation notification to dog owner
    console.log('Sending confirmation notification to dog owner...');
    try {
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
      console.log('Dog owner confirmation notification sent successfully');
    } catch (error) {
      console.error('Failed to send dog owner notification:', error);
    }

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
      (booking as any).userId === userId ||
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
    const { status, page = 1, limit = 10, includeExpired, includeFuture } = req.query;

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

    // Handle multiple statuses and date filtering
    if (status) {
      const statuses = (status as string).split(',');
      
      // If multiple statuses, use OR condition
      if (statuses.length > 1) {
        const statusConditions: any[] = [];
        const now = new Date();
        
        for (const s of statuses) {
          const statusCondition: any = { status: s };
          
          // For CANCELLED bookings, filter by date
          if (s === 'CANCELLED') {
            if (includeFuture === 'true') {
              // Upcoming tab: show cancelled bookings with future dates
              statusCondition.date = { gte: now };
            } else if (includeExpired === 'true') {
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
        } else {
          whereClause.OR = statusConditions;
        }
      } else {
        whereClause.status = status as string;
      }
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
        userId: (booking as any).userId,
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
        userId: (booking as any).userId,
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

  // Mark expired bookings (can be called by a cron job)
  markExpiredBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const now = new Date();
    
    // Find all bookings that are past their date/time and not completed/cancelled/expired
    const expiredBookings = await prisma.booking.updateMany({
      where: {
        status: {
          notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED'],
        },
        date: {
          lt: now,
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    res.json({
      success: true,
      message: `Marked ${expiredBookings.count} bookings as expired`,
      data: {
        count: expiredBookings.count,
      },
    });
  });

  // Check refund eligibility for a booking
  checkRefundEligibility = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const booking = await BookingModel.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Check authorization
    const isDogOwner = (booking as any).userId === userId;
    if (!isDogOwner) {
      throw new AppError('You are not authorized to check this booking', 403);
    }

    // Calculate refund eligibility based on booking date/time vs creation time
    const bookingCreatedAt = new Date(booking.createdAt);
    const bookingDate = new Date(booking.date);
    
    // Parse the booking start time to add to the date
    const [startHourStr, startPeriod] = booking.startTime.split(/(?=[AP]M)/);
    let startHour = parseInt(startHourStr.split(':')[0]);
    const startMinute = parseInt(startHourStr.split(':')[1] || '0');
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    
    bookingDate.setHours(startHour, startMinute, 0, 0);
    
    // Debug logging
    console.log('=== Refund Eligibility Check ===');
    console.log('Booking ID:', booking.id);
    console.log('Created at:', bookingCreatedAt.toISOString());
    console.log('Booking date/time:', bookingDate.toISOString());
    console.log('Start time:', booking.startTime);
    
    // Calculate hours between creation and booking date/time
    const hoursGap = (bookingDate.getTime() - bookingCreatedAt.getTime()) / (1000 * 60 * 60);
    const isRefundEligible = hoursGap >= 24;
    
    console.log('Hours gap:', hoursGap);
    console.log('Is refund eligible:', isRefundEligible);
    console.log('=========================');

    res.json({
      success: true,
      data: {
        isRefundEligible,
        hoursGap: Math.floor(hoursGap),
        message: isRefundEligible
          ? `This booking is eligible for a full refund. The booking date is ${Math.floor(hoursGap)} hours from when it was created.`
          : `This booking is not eligible for a refund. Bookings must be made at least 24 hours in advance. This booking was made only ${Math.floor(hoursGap)} hours before the scheduled time.`,
      },
    });
  });

  // Cancel booking (dog owner or field owner)
  cancelBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { reason } = req.body;

    const booking = await BookingModel.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Check authorization
    const isDogOwner = (booking as any).userId === userId;
    const isFieldOwner = (booking.field as any).ownerId === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isDogOwner && !isFieldOwner && !isAdmin) {
      throw new AppError('You are not authorized to cancel this booking', 403);
    }

    // Check if booking can be cancelled
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED' || booking.status === 'EXPIRED') {
      throw new AppError(`Cannot cancel a ${booking.status.toLowerCase()} booking`, 400);
    }

    // Calculate refund eligibility based on booking date/time vs creation time
    const bookingCreatedAt = new Date(booking.createdAt);
    const bookingDate = new Date(booking.date);
    
    // Parse the booking start time to add to the date
    const [startHourStr, startPeriod] = booking.startTime.split(/(?=[AP]M)/);
    let startHour = parseInt(startHourStr.split(':')[0]);
    const startMinute = parseInt(startHourStr.split(':')[1] || '0');
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    
    bookingDate.setHours(startHour, startMinute, 0, 0);
    
    // Debug logging for cancellation
    console.log('=== Cancel Booking Refund Check ===');
    console.log('Booking ID:', booking.id);
    console.log('Created at:', bookingCreatedAt.toISOString());
    console.log('Booking date/time:', bookingDate.toISOString());
    console.log('Start time:', booking.startTime);
    
    // Calculate hours between creation and booking date/time
    const hoursGap = (bookingDate.getTime() - bookingCreatedAt.getTime()) / (1000 * 60 * 60);
    
    // Refund is eligible if booking was made at least 24 hours in advance
    const isRefundEligible = hoursGap >= 24;
    
    console.log('Hours gap:', hoursGap);
    console.log('Is refund eligible:', isRefundEligible);
    console.log('===================================');

    const cancelledBooking = await BookingModel.cancel(id, reason);

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
        userId: (booking as any).userId,
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
        userId: (booking as any).userId,
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
      data: {
        ...cancelledBooking,
        isRefundEligible,
        refundMessage: isRefundEligible 
          ? 'You are eligible for a full refund. The amount will be credited to your account within 5-7 business days.'
          : 'This booking is not eligible for a refund as it was made less than 24 hours before the scheduled time.',
      },
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
    if ((booking as any).userId !== userId) {
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

  // Get detailed slot availability with dog limits
  getSlotAvailability = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { fieldId } = req.params;
    const { date } = req.query;

    if (!date) {
      throw new AppError('Date is required', 400);
    }

    // Get field details with maxDogs limit
    const field = await prisma.field.findUnique({
      where: { id: fieldId }
    });

    if (!field) {
      throw new AppError('Field not found', 404);
    }

    // Parse the date
    const selectedDate = new Date(date as string);
    const now = new Date();

    // Get start and end of day
    const startOfDayDate = new Date(selectedDate);
    startOfDayDate.setHours(0, 0, 0, 0);
    
    const endOfDayDate = new Date(selectedDate);
    endOfDayDate.setHours(23, 59, 59, 999);

    // Get all bookings for this field on the selected date (excluding cancelled)
    const bookings = await prisma.booking.findMany({
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
        numberOfDogs: true,
        status: true
      }
    });

    // Generate time slots based on field's operating hours
    const openingHour = field.openingTime ? parseInt(field.openingTime.split(':')[0]) : 6;
    const closingHour = field.closingTime ? parseInt(field.closingTime.split(':')[0]) : 21;
    const maxDogsPerSlot = field.maxDogs || 10; // Default to 10 if not specified

    const slots = [];

    for (let hour = openingHour; hour < closingHour; hour++) {
      // Format time slot
      const startTime = hour === 0 ? '12:00AM' : hour < 12 ? `${hour}:00AM` : hour === 12 ? '12:00PM' : `${hour - 12}:00PM`;
      const endHour = hour + 1;
      const endTime = endHour === 0 ? '12:00AM' : endHour < 12 ? `${endHour}:00AM` : endHour === 12 ? '12:00PM' : `${endHour - 12}:00PM`;
      const slotTime = `${startTime} - ${endTime}`;

      // Check if this slot is in the past
      const slotDateTime = new Date(selectedDate);
      slotDateTime.setHours(hour, 0, 0, 0);
      const isPast = slotDateTime < now;

      // Calculate total dogs booked for this time slot
      const bookedDogs = bookings
        .filter(booking => booking.timeSlot === slotTime || booking.startTime === startTime)
        .reduce((total, booking) => total + booking.numberOfDogs, 0);

      const availableSpots = maxDogsPerSlot - bookedDogs;
      const isFullyBooked = availableSpots <= 0;

      slots.push({
        time: slotTime,
        startHour: hour,
        isPast,
        isFullyBooked,
        availableSpots: Math.max(0, availableSpots),
        maxSpots: maxDogsPerSlot,
        bookedDogs,
        isAvailable: !isPast && !isFullyBooked
      });
    }

    res.json({
      success: true,
      data: {
        date: date as string,
        fieldId,
        fieldName: field.name,
        maxDogsPerSlot,
        slots,
        operatingHours: {
          opening: field.openingTime || '06:00',
          closing: field.closingTime || '21:00'
        },
        operatingDays: field.operatingDays
      }
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