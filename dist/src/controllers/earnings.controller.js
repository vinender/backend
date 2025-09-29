"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _asyncHandler = require("../utils/asyncHandler");
const _AppError = require("../utils/AppError");
const _database = /*#__PURE__*/ _interop_require_default(require("../config/database"));
const _autopayoutservice = require("../services/auto-payout.service");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class EarningsController {
    /**
   * Get comprehensive earnings dashboard for field owner
   */ getEarningsDashboard = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const userId = req.user.id;
        const userRole = req.user.role;
        if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
            throw new _AppError.AppError('Only field owners can view earnings dashboard', 403);
        }
        // Get all fields for this owner
        const userFields = await _database.default.field.findMany({
            where: {
                ownerId: userId
            },
            select: {
                id: true,
                name: true
            }
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
        const fieldIds = userFields.map((f)=>f.id);
        const now = new Date();
        // Calculate date ranges
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        // Get Stripe account first to fetch payouts
        const stripeAccount = await _database.default.stripeAccount.findUnique({
            where: {
                userId
            }
        });
        // Get successful payouts for total earnings calculation
        let totalEarningsFromPayouts = 0;
        let allSuccessfulPayouts = [];
        let todayPayouts = [];
        let weekPayouts = [];
        let monthPayouts = [];
        let yearPayouts = [];
        if (stripeAccount) {
            // Get all successful payouts
            allSuccessfulPayouts = await _database.default.payout.findMany({
                where: {
                    stripeAccountId: stripeAccount.id,
                    status: {
                        in: [
                            'paid',
                            'PAID',
                            'completed',
                            'COMPLETED'
                        ]
                    }
                }
            });
            // Calculate total earnings from successful payouts
            totalEarningsFromPayouts = allSuccessfulPayouts.reduce((sum, payout)=>sum + payout.amount, 0);
            // Filter payouts by date ranges
            todayPayouts = allSuccessfulPayouts.filter((p)=>new Date(p.createdAt) >= startOfDay);
            weekPayouts = allSuccessfulPayouts.filter((p)=>new Date(p.createdAt) >= startOfWeek);
            monthPayouts = allSuccessfulPayouts.filter((p)=>new Date(p.createdAt) >= startOfMonth);
            yearPayouts = allSuccessfulPayouts.filter((p)=>new Date(p.createdAt) >= startOfYear);
        }
        // Get all bookings for other calculations
        const [allBookings, completedPayoutBookings, pendingPayoutBookings] = await Promise.all([
            // All confirmed bookings (for field earnings breakdown)
            _database.default.booking.findMany({
                where: {
                    fieldId: {
                        in: fieldIds
                    },
                    status: {
                        in: [
                            'CONFIRMED',
                            'COMPLETED'
                        ]
                    },
                    paymentStatus: 'PAID'
                },
                include: {
                    field: {
                        select: {
                            name: true
                        }
                    },
                    user: {
                        select: {
                            name: true,
                            email: true
                        }
                    }
                }
            }),
            // Bookings with completed payouts
            _database.default.booking.findMany({
                where: {
                    fieldId: {
                        in: fieldIds
                    },
                    payoutStatus: 'COMPLETED'
                }
            }),
            // Pending payouts
            _database.default.booking.findMany({
                where: {
                    fieldId: {
                        in: fieldIds
                    },
                    status: 'CONFIRMED',
                    paymentStatus: 'PAID',
                    OR: [
                        {
                            payoutStatus: null
                        },
                        {
                            payoutStatus: {
                                in: [
                                    'PENDING',
                                    'PROCESSING'
                                ]
                            }
                        }
                    ]
                },
                include: {
                    field: {
                        select: {
                            name: true
                        }
                    },
                    user: {
                        select: {
                            name: true,
                            email: true
                        }
                    }
                }
            })
        ]);
        // Calculate earnings from bookings (for pending amounts)
        const calculateBookingEarnings = (bookings)=>{
            return bookings.reduce((sum, b)=>sum + (b.fieldOwnerAmount || b.totalPrice * 0.8), 0);
        };
        // Use payout amounts for period earnings
        const totalEarnings = totalEarningsFromPayouts;
        const todayEarnings = todayPayouts.reduce((sum, p)=>sum + p.amount, 0);
        const weekEarnings = weekPayouts.reduce((sum, p)=>sum + p.amount, 0);
        const monthEarnings = monthPayouts.reduce((sum, p)=>sum + p.amount, 0);
        const yearEarnings = yearPayouts.reduce((sum, p)=>sum + p.amount, 0);
        const completedPayoutAmount = calculateBookingEarnings(completedPayoutBookings);
        // Get payout summary
        const payoutSummary = await _autopayoutservice.automaticPayoutService.getPayoutSummary(userId);
        // Get recent payouts
        let recentPayouts = [];
        if (stripeAccount) {
            const payouts = await _database.default.payout.findMany({
                where: {
                    stripeAccountId: stripeAccount.id
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10
            });
            // Enhance with booking details
            recentPayouts = await Promise.all(payouts.map(async (payout)=>{
                const bookings = await _database.default.booking.findMany({
                    where: {
                        id: {
                            in: payout.bookingIds
                        }
                    },
                    include: {
                        field: {
                            select: {
                                name: true
                            }
                        },
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                });
                return {
                    id: payout.id,
                    amount: payout.amount,
                    status: payout.status,
                    createdAt: payout.createdAt,
                    arrivalDate: payout.arrivalDate,
                    bookings: bookings.map((b)=>({
                            id: b.id,
                            fieldName: b.field.name,
                            customerName: b.user.name || b.user.email,
                            date: b.date,
                            amount: b.fieldOwnerAmount || b.totalPrice * 0.8
                        }))
                };
            }));
        }
        // Calculate earnings by field (based on successful payouts)
        const fieldEarnings = await Promise.all(userFields.map(async (field)=>{
            const fieldBookings = allBookings.filter((b)=>b.fieldId === field.id);
            const bookingCount = fieldBookings.length;
            // Get successful payouts for this specific field
            let fieldPayoutTotal = 0;
            if (stripeAccount) {
                // Get booking IDs for this field that have completed payouts
                const completedFieldBookings = await _database.default.booking.findMany({
                    where: {
                        fieldId: field.id,
                        payoutStatus: 'COMPLETED'
                    },
                    select: {
                        id: true
                    }
                });
                const completedBookingIds = completedFieldBookings.map((b)=>b.id);
                // Get payouts that include these bookings
                const fieldPayouts = await _database.default.payout.findMany({
                    where: {
                        stripeAccountId: stripeAccount.id,
                        status: {
                            in: [
                                'paid',
                                'PAID',
                                'completed',
                                'COMPLETED'
                            ]
                        },
                        bookingIds: {
                            hasSome: completedBookingIds
                        }
                    }
                });
                // Sum up the payout amounts for this field
                // Note: This is approximate as payouts can contain multiple bookings
                fieldPayoutTotal = fieldPayouts.reduce((sum, payout)=>{
                    // Calculate portion of payout for this field
                    const payoutBookingCount = payout.bookingIds.length;
                    const fieldBookingCount = payout.bookingIds.filter((id)=>completedBookingIds.includes(id)).length;
                    const portion = payoutBookingCount > 0 ? fieldBookingCount / payoutBookingCount : 0;
                    return sum + payout.amount * portion;
                }, 0);
            }
            return {
                fieldId: field.id,
                fieldName: field.name,
                totalEarnings: fieldPayoutTotal,
                totalBookings: bookingCount,
                averageEarning: bookingCount > 0 ? fieldPayoutTotal / bookingCount : 0
            };
        }));
        // Get upcoming earnings (bookings in cancellation window)
        const upcomingEarnings = payoutSummary.bookingsInCancellationWindow.map((b)=>({
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
                stripeAccountComplete: stripeAccount ? stripeAccount.chargesEnabled && stripeAccount.payoutsEnabled : false
            }
        });
    });
    /**
   * Get detailed payout history with pagination
   */ getPayoutHistory = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const userId = req.user.id;
        const userRole = req.user.role;
        const { page = 1, limit = 20, status, startDate, endDate } = req.query;
        if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
            throw new _AppError.AppError('Only field owners can view payout history', 403);
        }
        const pageNum = Number(page);
        const limitNum = Number(limit);
        // Get Stripe account
        const stripeAccount = await _database.default.stripeAccount.findUnique({
            where: {
                userId
            }
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
        const whereClause = {
            stripeAccountId: stripeAccount.id
        };
        if (status) {
            whereClause.status = status;
        }
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) {
                whereClause.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                whereClause.createdAt.lte = new Date(endDate);
            }
        }
        // Get paginated payouts
        const skip = (pageNum - 1) * limitNum;
        const [payouts, total] = await Promise.all([
            _database.default.payout.findMany({
                where: whereClause,
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: limitNum
            }),
            _database.default.payout.count({
                where: whereClause
            })
        ]);
        // Enhance payouts with booking details
        const enhancedPayouts = await Promise.all(payouts.map(async (payout)=>{
            const bookings = await _database.default.booking.findMany({
                where: {
                    id: {
                        in: payout.bookingIds
                    }
                },
                include: {
                    field: {
                        select: {
                            name: true
                        }
                    },
                    user: {
                        select: {
                            name: true,
                            email: true
                        }
                    }
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
                bookings: bookings.map((b)=>({
                        id: b.id,
                        fieldName: b.field.name,
                        customerName: b.user.name || b.user.email,
                        date: b.date,
                        time: `${b.startTime} - ${b.endTime}`,
                        amount: b.fieldOwnerAmount || b.totalPrice * 0.8,
                        status: b.status
                    }))
            };
        }));
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
   */ exportPayoutHistory = (0, _asyncHandler.asyncHandler)(async (req, res, next)=>{
        const userId = req.user.id;
        const userRole = req.user.role;
        const { startDate, endDate } = req.query;
        if (userRole !== 'FIELD_OWNER' && userRole !== 'ADMIN') {
            throw new _AppError.AppError('Only field owners can export payout history', 403);
        }
        // Get Stripe account
        const stripeAccount = await _database.default.stripeAccount.findUnique({
            where: {
                userId
            }
        });
        if (!stripeAccount) {
            throw new _AppError.AppError('No Stripe account found', 404);
        }
        // Build where clause
        const whereClause = {
            stripeAccountId: stripeAccount.id
        };
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) {
                whereClause.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                whereClause.createdAt.lte = new Date(endDate);
            }
        }
        // Get all payouts
        const payouts = await _database.default.payout.findMany({
            where: whereClause,
            orderBy: {
                createdAt: 'desc'
            }
        });
        // Create CSV content
        const csvHeader = 'Date,Payout ID,Amount,Currency,Status,Method,Description,Arrival Date,Booking Count\n';
        const csvRows = await Promise.all(payouts.map(async (payout)=>{
            const bookingCount = payout.bookingIds.length;
            return `${payout.createdAt.toISOString()},${payout.stripePayoutId || 'N/A'},${payout.amount},${payout.currency},${payout.status},${payout.method},${payout.description || 'N/A'},${payout.arrivalDate?.toISOString() || 'N/A'},${bookingCount}`;
        }));
        const csvContent = csvHeader + csvRows.join('\n');
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="payouts_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
    });
}
const _default = new EarningsController();

//# sourceMappingURL=earnings.controller.js.map