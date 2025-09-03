"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Custom admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const admin = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!admin || admin.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.userId = admin.id;
        req.admin = admin;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
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
router.get('/verify', authenticateAdmin, async (req, res) => {
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
router.get('/stats', authenticateAdmin, async (req, res) => {
    try {
        // Get statistics
        const [totalUsers, totalFields, totalBookings, totalRevenue, recentBookings, dogOwners, fieldOwners] = await Promise.all([
            prisma.user.count(),
            prisma.field.count(),
            prisma.booking.count(),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { status: 'COMPLETED' }
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
            prisma.user.count({ where: { role: 'FIELD_OWNER' } })
        ]);
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalFields,
                totalBookings,
                totalRevenue: totalRevenue._sum.amount || 0,
                dogOwners,
                fieldOwners,
                recentBookings
            }
        });
    }
    catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all bookings for admin
router.get('/bookings', authenticateAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '10' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
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
            prisma.booking.count()
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
router.get('/bookings/:id', authenticateAdmin, async (req, res) => {
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
// Get all users for admin
router.get('/users', authenticateAdmin, async (req, res) => {
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
router.get('/fields', authenticateAdmin, async (req, res) => {
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
// Get all payments for admin
router.get('/payments', authenticateAdmin, async (req, res) => {
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
exports.default = router;
