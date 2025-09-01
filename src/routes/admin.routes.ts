import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Custom admin authentication middleware
const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    const admin = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!admin || admin.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    (req as any).userId = admin.id;
    (req as any).admin = admin;
    next();
  } catch (error) {
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
    const validPassword = await bcrypt.compare(password, admin.password || '');
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Return admin data without password
    const { password: _, ...adminData } = admin;

    res.json({
      success: true,
      token,
      admin: adminData
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify admin token endpoint
router.get('/verify', authenticateAdmin, async (req, res) => {
  try {
    const admin = (req as any).admin;
    const { password: _, ...adminData } = admin;

    res.json({
      success: true,
      admin: adminData
    });

  } catch (error) {
    console.error('Admin verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    // Get statistics
    const [
      totalUsers,
      totalFields,
      totalBookings,
      totalRevenue,
      recentBookings,
      dogOwners,
      fieldOwners
    ] = await Promise.all([
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

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all bookings for admin
router.get('/bookings', authenticateAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        skip,
        take: parseInt(limit as string),
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
      pages: Math.ceil(total / parseInt(limit as string))
    });

  } catch (error) {
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

  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users for admin
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '10', role } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = role ? { role: role as any } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit as string),
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
      pages: Math.ceil(total / parseInt(limit as string))
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all fields for admin
router.get('/fields', authenticateAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [fields, total] = await Promise.all([
      prisma.field.findMany({
        skip,
        take: parseInt(limit as string),
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
      pages: Math.ceil(total / parseInt(limit as string))
    });

  } catch (error) {
    console.error('Get fields error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all payments for admin
router.get('/payments', authenticateAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        skip,
        take: parseInt(limit as string),
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
      pages: Math.ceil(total / parseInt(limit as string))
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;