import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import prisma from '../config/database';
import { automaticPayoutService } from '../services/auto-payout.service';
import { payoutService } from '../services/payout.service';

class EarningsController {
  /**
   * Get comprehensive earnings dashboard for field owner
   */
  getEarningsDashboard = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    
    if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
      throw new AppError('Only field owners can view earnings dashboard', 403);
    }

    // Get all fields for this owner
    const userFields = await prisma.field.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true }
    });

    if (userFields.length === 0) {
      return res.json({
        success: true,
        data: {
          totalEarnings: 0,
          pendingPayouts: 0,
          completedPayouts: 0,
          upcomingPayouts: 0,
          todayEarnings: 0,
          weekEarnings: 0,
          monthEarnings: 0,
          yearEarnings: 0,
          recentPayouts: [],
          bookingsInCancellationWindow: [],
          fieldEarnings: []
        }
      });
    }

    const fieldIds = userFields.map(f => f.id);
    const now = new Date();
    
    // Calculate date ranges
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get all bookings for earnings calculation
    const [
      allBookings,
      todayBookings,
      weekBookings,
      monthBookings,
      yearBookings,
      completedPayouts,
      pendingPayoutBookings
    ] = await Promise.all([
      // All confirmed bookings
      prisma.booking.findMany({
        where: {
          fieldId: { in: fieldIds },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          paymentStatus: 'PAID'
        },
        include: {
          field: { select: { name: true } },
          user: { select: { name: true, email: true } }
        }
      }),
      
      // Today's bookings
      prisma.booking.findMany({
        where: {
          fieldId: { in: fieldIds },
          date: { gte: startOfDay },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          paymentStatus: 'PAID'
        }
      }),
      
      // This week's bookings
      prisma.booking.findMany({
        where: {
          fieldId: { in: fieldIds },
          date: { gte: startOfWeek },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          paymentStatus: 'PAID'
        }
      }),
      
      // This month's bookings
      prisma.booking.findMany({
        where: {
          fieldId: { in: fieldIds },
          date: { gte: startOfMonth },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          paymentStatus: 'PAID'
        }
      }),
      
      // This year's bookings
      prisma.booking.findMany({
        where: {
          fieldId: { in: fieldIds },
          date: { gte: startOfYear },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          paymentStatus: 'PAID'
        }
      }),
      
      // Completed payouts
      prisma.booking.findMany({
        where: {
          fieldId: { in: fieldIds },
          payoutStatus: 'COMPLETED'
        }
      }),
      
      // Pending payouts
      prisma.booking.findMany({
        where: {
          fieldId: { in: fieldIds },
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          OR: [
            { payoutStatus: null },
            { payoutStatus: { in: ['PENDING', 'PROCESSING'] } }
          ]
        },
        include: {
          field: { select: { name: true } },
          user: { select: { name: true, email: true } }
        }
      })
    ]);

    // Calculate earnings
    const calculateEarnings = (bookings: any[]) => {
      return bookings.reduce((sum, b) => sum + (b.fieldOwnerAmount || b.totalPrice * 0.8), 0);
    };

    const totalEarnings = calculateEarnings(allBookings);
    const todayEarnings = calculateEarnings(todayBookings);
    const weekEarnings = calculateEarnings(weekBookings);
    const monthEarnings = calculateEarnings(monthBookings);
    const yearEarnings = calculateEarnings(yearBookings);
    const completedPayoutAmount = calculateEarnings(completedPayouts);
    
    // Get payout summary
    const payoutSummary = await automaticPayoutService.getPayoutSummary(userId);
    
    // Get recent payouts
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { userId }
    });
    
    let recentPayouts: any[] = [];
    if (stripeAccount) {
      const payouts = await prisma.payout.findMany({
        where: { stripeAccountId: stripeAccount.id },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      
      // Enhance with booking details
      recentPayouts = await Promise.all(
        payouts.map(async (payout) => {
          const bookings = await prisma.booking.findMany({
            where: { id: { in: payout.bookingIds } },
            include: {
              field: { select: { name: true } },
              user: { select: { name: true, email: true } }
            }
          });
          
          return {
            id: payout.id,
            amount: payout.amount,
            status: payout.status,
            createdAt: payout.createdAt,
            arrivalDate: payout.arrivalDate,
            bookings: bookings.map(b => ({
              id: b.id,
              fieldName: b.field.name,
              customerName: b.user.name || b.user.email,
              date: b.date,
              amount: b.fieldOwnerAmount || b.totalPrice * 0.8
            }))
          };
        })
      );
    }
    
    // Calculate earnings by field
    const fieldEarnings = userFields.map(field => {
      const fieldBookings = allBookings.filter(b => b.fieldId === field.id);
      const earnings = calculateEarnings(fieldBookings);
      const bookingCount = fieldBookings.length;
      
      return {
        fieldId: field.id,
        fieldName: field.name,
        totalEarnings: earnings,
        totalBookings: bookingCount,
        averageEarning: bookingCount > 0 ? earnings / bookingCount : 0
      };
    });
    
    // Get upcoming earnings (bookings in cancellation window)
    const upcomingEarnings = payoutSummary.bookingsInCancellationWindow.map(b => ({
      ...b,
      hoursUntilPayout: Math.max(0, Math.floor((new Date(b.payoutAvailableAt).getTime() - now.getTime()) / (1000 * 60 * 60)))
    }));

    res.json({
      success: true,
      data: {
        // Total earnings overview
        totalEarnings,
        pendingPayouts: payoutSummary.pendingPayouts,
        completedPayouts: completedPayoutAmount,
        upcomingPayouts: payoutSummary.upcomingPayouts,
        
        // Period-based earnings
        todayEarnings,
        weekEarnings,
        monthEarnings,
        yearEarnings,
        
        // Recent payouts
        recentPayouts,
        
        // Upcoming earnings (in cancellation window)
        upcomingEarnings,
        
        // Earnings by field
        fieldEarnings,
        
        // Stripe account status
        hasStripeAccount: !!stripeAccount,
        stripeAccountComplete: stripeAccount ? (stripeAccount.chargesEnabled && stripeAccount.payoutsEnabled) : false
      }
    });
  });

  /**
   * Get detailed payout history with pagination
   */
  getPayoutHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;
    
    if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
      throw new AppError('Only field owners can view payout history', 403);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    
    // Get Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { userId }
    });
    
    if (!stripeAccount) {
      return res.json({
        success: true,
        data: {
          payouts: [],
          total: 0,
          page: pageNum,
          limit: limitNum,
          totalPages: 0
        }
      });
    }
    
    // Build where clause
    const whereClause: any = { stripeAccountId: stripeAccount.id };
    
    if (status) {
      whereClause.status = status as string;
    }
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate as string);
      }
    }
    
    // Get paginated payouts
    const skip = (pageNum - 1) * limitNum;
    
    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.payout.count({ where: whereClause })
    ]);
    
    // Enhance payouts with booking details
    const enhancedPayouts = await Promise.all(
      payouts.map(async (payout) => {
        const bookings = await prisma.booking.findMany({
          where: { id: { in: payout.bookingIds } },
          include: {
            field: { select: { name: true } },
            user: { select: { name: true, email: true } }
          }
        });
        
        return {
          id: payout.id,
          stripePayoutId: payout.stripePayoutId,
          amount: payout.amount,
          currency: payout.currency,
          status: payout.status,
          method: payout.method,
          description: payout.description,
          arrivalDate: payout.arrivalDate,
          createdAt: payout.createdAt,
          bookingCount: bookings.length,
          bookings: bookings.map(b => ({
            id: b.id,
            fieldName: b.field.name,
            customerName: b.user.name || b.user.email,
            date: b.date,
            time: `${b.startTime} - ${b.endTime}`,
            amount: b.fieldOwnerAmount || b.totalPrice * 0.8,
            status: b.status
          }))
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        payouts: enhancedPayouts,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  });

  /**
   * Export payout history as CSV
   */
  exportPayoutHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { startDate, endDate } = req.query;
    
    if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
      throw new AppError('Only field owners can export payout history', 403);
    }
    
    // Get Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { userId }
    });
    
    if (!stripeAccount) {
      throw new AppError('No Stripe account found', 404);
    }
    
    // Build where clause
    const whereClause: any = { stripeAccountId: stripeAccount.id };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate as string);
      }
    }
    
    // Get all payouts
    const payouts = await prisma.payout.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    
    // Create CSV content
    const csvHeader = 'Date,Payout ID,Amount,Currency,Status,Method,Description,Arrival Date,Booking Count\n';
    
    const csvRows = await Promise.all(
      payouts.map(async (payout) => {
        const bookingCount = payout.bookingIds.length;
        return `${payout.createdAt.toISOString()},${payout.stripePayoutId || 'N/A'},${payout.amount},${payout.currency},${payout.status},${payout.method},${payout.description || 'N/A'},${payout.arrivalDate?.toISOString() || 'N/A'},${bookingCount}`;
      })
    );
    
    const csvContent = csvHeader + csvRows.join('\n');
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payouts_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  });
}

export default new EarningsController();