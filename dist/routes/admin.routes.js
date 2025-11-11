"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-nocheck
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const admin_middleware_1 = require("../middleware/admin.middleware");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Admin login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Find admin user - first find by email, then check role
        const admin = await prisma.user.findFirst({
            where: {
                email,
                role: 'ADMIN'
            }
        });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Verify password
        const validPassword = await bcryptjs_1.default.compare(password, admin.password || '');
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ userId: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
        // Return admin data without password
        const { password: _, ...adminData } = admin;
        res.json({
            success: true,
            token,
            admin: adminData
        });
    }
    catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Verify admin token endpoint
router.get('/verify', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const admin = req.admin;
        const { password: _, ...adminData } = admin;
        res.json({
            success: true,
            admin: adminData
        });
    }
    catch (error) {
        console.error('Admin verify error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get dashboard statistics
router.get('/stats', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { period = 'Today' } = req.query;
        // Get current date and calculate date ranges based on period
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate;
        let compareStartDate;
        let compareEndDate;
        switch (period) {
            case 'Today':
                startDate = startOfToday;
                compareStartDate = new Date(startOfToday);
                compareStartDate.setDate(compareStartDate.getDate() - 1);
                compareEndDate = new Date(startOfToday);
                compareEndDate.setMilliseconds(compareEndDate.getMilliseconds() - 1);
                break;
            case 'Weekly':
                startDate = new Date(startOfToday);
                startDate.setDate(startDate.getDate() - 7);
                compareStartDate = new Date(startDate);
                compareStartDate.setDate(compareStartDate.getDate() - 7);
                compareEndDate = new Date(startDate);
                compareEndDate.setMilliseconds(compareEndDate.getMilliseconds() - 1);
                break;
            case 'Monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                compareStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                compareEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                break;
            case 'Yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                compareStartDate = new Date(now.getFullYear() - 1, 0, 1);
                compareEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
                break;
            default:
                startDate = startOfToday;
                compareStartDate = new Date(startOfToday);
                compareStartDate.setDate(compareStartDate.getDate() - 1);
                compareEndDate = new Date(startOfToday);
                compareEndDate.setMilliseconds(compareEndDate.getMilliseconds() - 1);
        }
        // Get current statistics
        const [totalUsers, totalFields, totalBookings, totalRevenue, upcomingBookings, recentBookings, dogOwners, fieldOwners, 
        // Yesterday's stats for comparison
        yesterdayUsers, yesterdayFields, yesterdayBookings, yesterdayRevenue, yesterdayUpcomingBookings] = await Promise.all([
            // Current stats
            prisma.user.count(),
            prisma.field.count(),
            prisma.booking.count(),
            prisma.booking.aggregate({
                _sum: { totalPrice: true },
                where: { paymentStatus: 'PAID' }
            }),
            prisma.booking.count({
                where: {
                    date: { gte: now },
                    status: { in: ['PENDING', 'CONFIRMED'] }
                }
            }),
            prisma.booking.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: true,
                    field: true
                }
            }),
            prisma.user.count({ where: { role: 'DOG_OWNER' } }),
            prisma.user.count({ where: { role: 'FIELD_OWNER' } }),
            // Previous period stats for comparison
            prisma.user.count({
                where: {
                    createdAt: { lte: compareEndDate }
                }
            }),
            prisma.field.count({
                where: {
                    createdAt: { lte: compareEndDate }
                }
            }),
            prisma.booking.count({
                where: {
                    createdAt: { lte: compareEndDate }
                }
            }),
            prisma.booking.aggregate({
                _sum: { totalPrice: true },
                where: {
                    paymentStatus: 'PAID',
                    createdAt: { lte: compareEndDate }
                }
            }),
            prisma.booking.count({
                where: {
                    date: { gte: compareStartDate },
                    createdAt: { lte: compareEndDate },
                    status: { in: ['PENDING', 'CONFIRMED'] }
                }
            })
        ]);
        // Calculate growth percentages
        const calculateGrowth = (current, yesterday) => {
            if (!yesterday || yesterday === 0) {
                return current > 0 ? 100 : 0;
            }
            return Number(((current - yesterday) / yesterday * 100).toFixed(1));
        };
        const currentRevenue = totalRevenue._sum.totalPrice || 0;
        const yesterdayRevenueValue = yesterdayRevenue._sum.totalPrice || 0;
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalFields,
                totalBookings,
                totalRevenue: currentRevenue,
                upcomingBookings,
                dogOwners,
                fieldOwners,
                recentBookings,
                // Growth percentages
                growth: {
                    users: calculateGrowth(totalUsers, yesterdayUsers),
                    fields: calculateGrowth(totalFields, yesterdayFields),
                    bookings: calculateGrowth(totalBookings, yesterdayBookings),
                    revenue: calculateGrowth(currentRevenue, yesterdayRevenueValue),
                    upcomingBookings: calculateGrowth(upcomingBookings, yesterdayUpcomingBookings)
                }
            }
        });
    }
    catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get total revenue
router.get('/revenue/total', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const totalRevenue = await prisma.booking.aggregate({
            _sum: { totalPrice: true },
            where: { paymentStatus: 'PAID' }
        });
        res.json({
            success: true,
            totalRevenue: totalRevenue._sum.totalPrice || 0
        });
    }
    catch (error) {
        console.error('Revenue error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all bookings for admin
router.get('/bookings', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '10', searchName } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        // Build where clause for name search
        const whereClause = {};
        if (searchName && typeof searchName === 'string' && searchName.trim()) {
            whereClause.user = {
                name: {
                    contains: searchName.trim(),
                    mode: 'insensitive' // Case-insensitive search
                }
            };
        }
        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where: whereClause,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    user: true,
                    field: {
                        include: {
                            owner: true
                        }
                    },
                    payment: true
                }
            }),
            prisma.booking.count({ where: whereClause })
        ]);
        res.json({
            success: true,
            bookings,
            total,
            pages: Math.ceil(total / parseInt(limit))
        });
    }
    catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get booking details
router.get('/bookings/:id', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: req.params.id },
            include: {
                user: true,
                field: {
                    include: {
                        owner: true
                    }
                },
                payment: true
            }
        });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json({
            success: true,
            booking
        });
    }
    catch (error) {
        console.error('Get booking details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user details with bookings
router.get('/users/:id', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                image: true,
                googleImage: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        bookings: true,
                        ownedFields: true
                    }
                },
                bookings: {
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        date: true,
                        startTime: true,
                        endTime: true,
                        numberOfDogs: true,
                        totalPrice: true,
                        status: true,
                        paymentStatus: true,
                        createdAt: true,
                        field: {
                            select: {
                                name: true,
                                location: true
                            }
                        }
                    }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            user
        });
    }
    catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all users for admin
router.get('/users', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '10', role } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = role ? { role: role } : {};
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    phone: true,
                    emailVerified: true,
                    createdAt: true,
                    _count: {
                        select: {
                            bookings: true,
                            ownedFields: true
                        }
                    }
                }
            }),
            prisma.user.count({ where })
        ]);
        res.json({
            success: true,
            users,
            total,
            pages: Math.ceil(total / parseInt(limit))
        });
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all fields for admin
router.get('/fields', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '10' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [fields, total] = await Promise.all([
            prisma.field.findMany({
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    owner: true,
                    _count: {
                        select: {
                            bookings: true
                        }
                    }
                }
            }),
            prisma.field.count()
        ]);
        res.json({
            success: true,
            fields,
            total,
            pages: Math.ceil(total / parseInt(limit))
        });
    }
    catch (error) {
        console.error('Get fields error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all notifications for admin (including both dog owner and field owner notifications)
router.get('/notifications', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        // Get admin user ID to also show admin-specific notifications
        const adminId = req.userId;
        // Get all notifications (system-wide) with user details
        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            }),
            prisma.notification.count(),
            // Count unread admin notifications
            prisma.notification.count({
                where: {
                    OR: [
                        { userId: adminId }, // Admin's own notifications
                        { type: { in: ['user_registered', 'field_added', 'payment_received', 'booking_received'] } } // System-wide events
                    ],
                    read: false
                }
            })
        ]);
        res.json({
            success: true,
            notifications,
            total,
            unreadCount,
            pages: Math.ceil(total / parseInt(limit))
        });
    }
    catch (error) {
        console.error('Get admin notifications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark notification as read for admin
router.patch('/notifications/:id/read', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const notification = await prisma.notification.update({
            where: { id: req.params.id },
            data: {
                read: true,
                readAt: new Date()
            }
        });
        res.json({
            success: true,
            notification
        });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark all admin notifications as read
router.patch('/notifications/read-all', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const adminId = req.userId;
        // Mark all system-wide notifications as read
        await prisma.notification.updateMany({
            where: {
                OR: [
                    { userId: adminId },
                    { type: { in: ['user_registered', 'field_added', 'payment_received', 'booking_received'] } }
                ],
                read: false
            },
            data: {
                read: true,
                readAt: new Date()
            }
        });
        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete notification for admin
router.delete('/notifications/:id', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        await prisma.notification.delete({
            where: { id: req.params.id }
        });
        res.json({
            success: true,
            message: 'Notification deleted'
        });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all payments for admin
router.get('/payments', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '10' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    booking: {
                        include: {
                            user: true,
                            field: true
                        }
                    }
                }
            }),
            prisma.payment.count()
        ]);
        res.json({
            success: true,
            payments,
            total,
            pages: Math.ceil(total / parseInt(limit))
        });
    }
    catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get booking stats based on period
router.get('/booking-stats', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { period = 'Today' } = req.query;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate;
        let endDate = now;
        switch (period) {
            case 'Today':
                startDate = startOfToday;
                break;
            case 'Weekly':
                startDate = new Date(startOfToday);
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'Monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'Yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = startOfToday;
        }
        // Get booking stats by status
        const [completed, cancelled, refunded, pending, confirmed] = await Promise.all([
            prisma.booking.count({
                where: {
                    status: 'COMPLETED',
                    createdAt: { gte: startDate, lte: endDate }
                }
            }),
            prisma.booking.count({
                where: {
                    status: 'CANCELLED',
                    createdAt: { gte: startDate, lte: endDate }
                }
            }),
            prisma.booking.count({
                where: {
                    paymentStatus: 'REFUNDED',
                    createdAt: { gte: startDate, lte: endDate }
                }
            }),
            prisma.booking.count({
                where: {
                    status: 'PENDING',
                    createdAt: { gte: startDate, lte: endDate }
                }
            }),
            prisma.booking.count({
                where: {
                    status: 'CONFIRMED',
                    createdAt: { gte: startDate, lte: endDate }
                }
            })
        ]);
        // Calculate data points for chart
        let chartData = [];
        if (period === 'Today' || period === 'Weekly') {
            // Show daily data
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            for (let i = 0; i < 7; i++) {
                const dayStart = new Date(startDate);
                dayStart.setDate(startDate.getDate() + i);
                const dayEnd = new Date(dayStart);
                dayEnd.setDate(dayEnd.getDate() + 1);
                const [dayCompleted, dayCancelled, dayRefunded] = await Promise.all([
                    prisma.booking.count({
                        where: {
                            status: 'COMPLETED',
                            createdAt: { gte: dayStart, lt: dayEnd }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            status: 'CANCELLED',
                            createdAt: { gte: dayStart, lt: dayEnd }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            paymentStatus: 'REFUNDED',
                            createdAt: { gte: dayStart, lt: dayEnd }
                        }
                    })
                ]);
                const dayIndex = dayStart.getDay();
                chartData.push({
                    day: days[dayIndex === 0 ? 6 : dayIndex - 1],
                    values: [dayCompleted, dayCancelled, dayRefunded]
                });
            }
        }
        else if (period === 'Monthly') {
            // Show weekly data for the month
            const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
            for (let i = 0; i < 4; i++) {
                const weekStart = new Date(startDate);
                weekStart.setDate(startDate.getDate() + (i * 7));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 7);
                const [weekCompleted, weekCancelled, weekRefunded] = await Promise.all([
                    prisma.booking.count({
                        where: {
                            status: 'COMPLETED',
                            createdAt: { gte: weekStart, lt: weekEnd }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            status: 'CANCELLED',
                            createdAt: { gte: weekStart, lt: weekEnd }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            paymentStatus: 'REFUNDED',
                            createdAt: { gte: weekStart, lt: weekEnd }
                        }
                    })
                ]);
                chartData.push({
                    day: weeks[i],
                    values: [weekCompleted, weekCancelled, weekRefunded]
                });
            }
        }
        else {
            // Show monthly data for the year
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for (let i = 0; i < 12; i++) {
                const monthStart = new Date(now.getFullYear(), i, 1);
                const monthEnd = new Date(now.getFullYear(), i + 1, 0);
                const [monthCompleted, monthCancelled, monthRefunded] = await Promise.all([
                    prisma.booking.count({
                        where: {
                            status: 'COMPLETED',
                            createdAt: { gte: monthStart, lte: monthEnd }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            status: 'CANCELLED',
                            createdAt: { gte: monthStart, lte: monthEnd }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            paymentStatus: 'REFUNDED',
                            createdAt: { gte: monthStart, lte: monthEnd }
                        }
                    })
                ]);
                chartData.push({
                    day: months[i],
                    values: [monthCompleted, monthCancelled, monthRefunded]
                });
            }
        }
        res.json({
            success: true,
            stats: {
                completed,
                cancelled,
                refunded,
                pending,
                confirmed,
                total: completed + cancelled + refunded + pending + confirmed
            },
            chartData
        });
    }
    catch (error) {
        console.error('Booking stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get field utilization stats
router.get('/field-utilization', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { period = 'Today' } = req.query;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate;
        let endDate = now;
        switch (period) {
            case 'Today':
                startDate = startOfToday;
                break;
            case 'Weekly':
                startDate = new Date(startOfToday);
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'Monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'Yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = startOfToday;
        }
        // Get top fields by bookings
        const topFields = await prisma.field.findMany({
            take: 5,
            orderBy: {
                bookings: {
                    _count: 'desc'
                }
            },
            include: {
                _count: {
                    select: {
                        bookings: {
                            where: {
                                createdAt: { gte: startDate, lte: endDate }
                            }
                        }
                    }
                }
            }
        });
        // Calculate utilization chart data
        let chartData = [];
        if (period === 'Today' || period === 'Weekly') {
            // Show daily utilization
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            for (let i = 0; i < 7; i++) {
                const dayStart = new Date(startDate);
                dayStart.setDate(startDate.getDate() + i);
                const dayEnd = new Date(dayStart);
                dayEnd.setDate(dayEnd.getDate() + 1);
                const [fieldsWithBookings, totalBookings, avgUtilization] = await Promise.all([
                    prisma.field.count({
                        where: {
                            bookings: {
                                some: {
                                    createdAt: { gte: dayStart, lt: dayEnd }
                                }
                            }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            createdAt: { gte: dayStart, lt: dayEnd }
                        }
                    }),
                    prisma.field.count()
                ]);
                const utilizationRate = avgUtilization > 0 ? Math.round((fieldsWithBookings / avgUtilization) * 100) : 0;
                const dayIndex = dayStart.getDay();
                chartData.push({
                    day: days[dayIndex === 0 ? 6 : dayIndex - 1],
                    values: [fieldsWithBookings, totalBookings, utilizationRate]
                });
            }
        }
        else if (period === 'Monthly') {
            // Show weekly utilization
            const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
            for (let i = 0; i < 4; i++) {
                const weekStart = new Date(startDate);
                weekStart.setDate(startDate.getDate() + (i * 7));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 7);
                const [fieldsWithBookings, totalBookings, avgUtilization] = await Promise.all([
                    prisma.field.count({
                        where: {
                            bookings: {
                                some: {
                                    createdAt: { gte: weekStart, lt: weekEnd }
                                }
                            }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            createdAt: { gte: weekStart, lt: weekEnd }
                        }
                    }),
                    prisma.field.count()
                ]);
                const utilizationRate = avgUtilization > 0 ? Math.round((fieldsWithBookings / avgUtilization) * 100) : 0;
                chartData.push({
                    day: weeks[i],
                    values: [fieldsWithBookings, totalBookings, utilizationRate]
                });
            }
        }
        else {
            // Show monthly utilization
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for (let i = 0; i < 12; i++) {
                const monthStart = new Date(now.getFullYear(), i, 1);
                const monthEnd = new Date(now.getFullYear(), i + 1, 0);
                const [fieldsWithBookings, totalBookings, avgUtilization] = await Promise.all([
                    prisma.field.count({
                        where: {
                            bookings: {
                                some: {
                                    createdAt: { gte: monthStart, lte: monthEnd }
                                }
                            }
                        }
                    }),
                    prisma.booking.count({
                        where: {
                            createdAt: { gte: monthStart, lte: monthEnd }
                        }
                    }),
                    prisma.field.count()
                ]);
                const utilizationRate = avgUtilization > 0 ? Math.round((fieldsWithBookings / avgUtilization) * 100) : 0;
                chartData.push({
                    day: months[i],
                    values: [fieldsWithBookings, totalBookings, utilizationRate]
                });
            }
        }
        res.json({
            success: true,
            topFields,
            chartData
        });
    }
    catch (error) {
        console.error('Field utilization error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all claims for admin
router.get('/claims', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { status, page = '1', limit = '10' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (status) {
            where.status = status;
        }
        const [claimsWithoutField, total] = await Promise.all([
            prisma.fieldClaim.findMany({
                where,
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: parseInt(limit)
            }),
            prisma.fieldClaim.count({ where })
        ]);
        // Fetch field data separately to handle null fields gracefully
        const claims = await Promise.all(claimsWithoutField.map(async (claim) => {
            let field = null;
            if (claim.fieldId) {
                try {
                    field = await prisma.field.findUnique({
                        where: { id: claim.fieldId },
                        select: {
                            id: true,
                            name: true,
                            address: true,
                            city: true,
                            state: true
                        }
                    });
                }
                catch (err) {
                    // Field might not exist, continue with null
                }
            }
            return {
                ...claim,
                field
            };
        }));
        res.json({
            success: true,
            claims,
            total,
            pages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page)
        });
    }
    catch (error) {
        console.error('Get claims error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single claim details for admin
router.get('/claims/:claimId', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { claimId } = req.params;
        const claim = await prisma.fieldClaim.findUnique({
            where: { id: claimId }
        });
        if (!claim) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        // Fetch field data separately to handle null fields
        let field = null;
        if (claim.fieldId) {
            try {
                field = await prisma.field.findUnique({
                    where: { id: claim.fieldId },
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        state: true,
                        location: true
                    }
                });
            }
            catch (err) {
                // Field might not exist, continue with null
            }
        }
        res.json({
            success: true,
            claim: {
                ...claim,
                field
            }
        });
    }
    catch (error) {
        console.error('Get claim details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update claim status (approve/reject) for admin
router.patch('/claims/:claimId/status', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const { claimId } = req.params;
        const { status, reviewNotes } = req.body;
        const adminId = req.userId;
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED' });
        }
        // Update the claim
        const updatedClaim = await prisma.fieldClaim.update({
            where: { id: claimId },
            data: {
                status,
                reviewNotes,
                reviewedAt: new Date(),
                reviewedBy: adminId
            },
            include: {
                field: true
            }
        });
        // If approved, update the field
        if (status === 'APPROVED' && updatedClaim.field) {
            await prisma.field.update({
                where: { id: updatedClaim.fieldId },
                data: {
                    isClaimed: true,
                    ownerId: updatedClaim.userId || undefined
                }
            });
        }
        res.json({
            success: true,
            claim: updatedClaim,
            message: `Claim ${status.toLowerCase()} successfully`
        });
    }
    catch (error) {
        console.error('Update claim status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update admin profile
router.patch('/profile', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const adminId = req.userId;
        const { name, phone, bio } = req.body;
        const updates = {};
        if (name !== undefined)
            updates.name = name;
        if (phone !== undefined)
            updates.phone = phone;
        if (bio !== undefined)
            updates.bio = bio;
        const updatedAdmin = await prisma.user.update({
            where: { id: adminId },
            data: updates
        });
        const { password: _, ...adminData } = updatedAdmin;
        res.json({
            success: true,
            admin: adminData
        });
    }
    catch (error) {
        console.error('Update admin profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Upload admin profile image
router.post('/profile/upload-image', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const adminId = req.userId;
        const upload = await Promise.resolve().then(() => __importStar(require('../middleware/upload.middleware')));
        const uploadSingle = upload.uploadSingle('image');
        uploadSingle(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            const updatedAdmin = await prisma.user.update({
                where: { id: adminId },
                data: { image: file.location }
            });
            const { password: _, ...adminData } = updatedAdmin;
            res.json({
                success: true,
                admin: adminData,
                imageUrl: file.location
            });
        });
    }
    catch (error) {
        console.error('Upload admin profile image error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete admin profile image
router.delete('/profile/delete-image', admin_middleware_1.authenticateAdmin, async (req, res) => {
    try {
        const adminId = req.userId;
        const updatedAdmin = await prisma.user.update({
            where: { id: adminId },
            data: { image: null }
        });
        const { password: _, ...adminData } = updatedAdmin;
        res.json({
            success: true,
            admin: adminData
        });
    }
    catch (error) {
        console.error('Delete admin profile image error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
