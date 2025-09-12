import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import jwt from 'jsonwebtoken';

const router = Router();

// Admin authentication middleware
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

    (req as any).user = admin;
    (req as any).userId = admin.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get system commission settings
router.get('/settings', authenticateAdmin, async (req, res) => {
  try {

    // Get or create system settings
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          defaultCommissionRate: 20 // Default 20% commission
        }
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching commission settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch commission settings' 
    });
  }
});

// Update default commission rate
router.put('/settings', authenticateAdmin, async (req, res) => {
  try {

    const { defaultCommissionRate } = req.body;

    // Validate commission rate
    if (typeof defaultCommissionRate !== 'number' || defaultCommissionRate < 0 || defaultCommissionRate > 100) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100'
      });
    }

    // Get or create system settings
    let settings = await prisma.systemSettings.findFirst();
    
    if (settings) {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { defaultCommissionRate }
      });
    } else {
      settings = await prisma.systemSettings.create({
        data: { defaultCommissionRate }
      });
    }

    res.json({
      success: true,
      data: settings,
      message: 'Default commission rate updated successfully'
    });
  } catch (error) {
    console.error('Error updating commission settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update commission settings' 
    });
  }
});

// Get field owner commission rate
router.get('/field-owner/:userId', authenticateAdmin, async (req, res) => {
  try {

    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        commissionRate: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Field owner not found'
      });
    }

    // Get default commission if user doesn't have custom rate
    let defaultRate = 20;
    if (!user.commissionRate) {
      const settings = await prisma.systemSettings.findFirst();
      if (settings) {
        defaultRate = settings.defaultCommissionRate;
      }
    }

    res.json({
      success: true,
      data: {
        ...user,
        effectiveCommissionRate: user.commissionRate || defaultRate,
        isUsingDefault: !user.commissionRate
      }
    });
  } catch (error) {
    console.error('Error fetching field owner commission:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch field owner commission' 
    });
  }
});

// Update field owner commission rate
router.put('/field-owner/:userId', authenticateAdmin, async (req, res) => {
  try {

    const { userId } = req.params;
    const { commissionRate, useDefault } = req.body;

    // If useDefault is true, set commission to null to use system default
    if (useDefault) {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { commissionRate: null }
      });

      return res.json({
        success: true,
        data: user,
        message: 'Field owner set to use default commission rate'
      });
    }

    // Validate commission rate
    if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100'
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { commissionRate }
    });

    res.json({
      success: true,
      data: user,
      message: 'Field owner commission rate updated successfully'
    });
  } catch (error) {
    console.error('Error updating field owner commission:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update field owner commission' 
    });
  }
});

// Get all field owners with commission rates
router.get('/field-owners', authenticateAdmin, async (req, res) => {
  try {

    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build search filter
    const searchFilter = search
      ? {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' as const } },
            { email: { contains: String(search), mode: 'insensitive' as const } }
          ]
        }
      : {};

    // Get field owners with commission rates
    const fieldOwners = await prisma.user.findMany({
      where: {
        role: 'FIELD_OWNER',
        ...searchFilter
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        commissionRate: true,
        createdAt: true,
        _count: {
          select: {
            ownedFields: true
          }
        }
      },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    });

    // Get total count
    const total = await prisma.user.count({
      where: {
        role: 'FIELD_OWNER',
        ...searchFilter
      }
    });

    // Get default commission rate
    const settings = await prisma.systemSettings.findFirst();
    const defaultRate = settings?.defaultCommissionRate || 20;

    // Add effective commission rate to each field owner
    const fieldOwnersWithEffectiveRate = fieldOwners.map(owner => ({
      ...owner,
      effectiveCommissionRate: owner.commissionRate || defaultRate,
      isUsingDefault: !owner.commissionRate,
      fieldsCount: owner._count.ownedFields
    }));

    res.json({
      success: true,
      data: {
        fieldOwners: fieldOwnersWithEffectiveRate,
        defaultCommissionRate: defaultRate,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching field owners with commission:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch field owners' 
    });
  }
});

export default router;