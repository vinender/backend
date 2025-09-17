import { Router, Request, Response, NextFunction } from 'express';
import { 
  getSystemSettings, 
  updateSystemSettings,
  getPublicSettings
} from '../controllers/settings.controller';
import { protect } from '../middleware/auth.middleware';
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
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Public route - get settings needed for frontend (no auth required)
router.get('/public', getPublicSettings);

// Admin routes
router.get('/admin', authenticateAdmin, getSystemSettings);
router.put('/admin', authenticateAdmin, updateSystemSettings);

// Authenticated route for logged-in users to get certain settings
router.get('/user', protect, getPublicSettings);

export default router;