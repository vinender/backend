import { Router, Request, Response, NextFunction } from 'express';
import {
  getFAQs,
  getAllFAQs,
  getFAQ,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  bulkUpsertFAQs,
  reorderFAQs
} from '../controllers/faq.controller';
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

// Public routes
router.get('/public', getFAQs); // Get active FAQs for public display

// Admin routes
router.get('/admin', authenticateAdmin, getAllFAQs); // Get all FAQs including inactive
router.get('/admin/:id', authenticateAdmin, getFAQ); // Get single FAQ
router.post('/admin', authenticateAdmin, createFAQ); // Create new FAQ
router.put('/admin/:id', authenticateAdmin, updateFAQ); // Update FAQ
router.delete('/admin/:id', authenticateAdmin, deleteFAQ); // Delete FAQ
router.post('/admin/bulk', authenticateAdmin, bulkUpsertFAQs); // Bulk create/update
router.put('/admin/reorder', authenticateAdmin, reorderFAQs); // Reorder FAQs

export default router;