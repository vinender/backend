import { Router, Request, Response, NextFunction } from 'express';
import { uploadDirect, uploadMultiple, upload } from '../controllers/upload.controller';
import { protect } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

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

// Upload single file - for regular users
router.post('/direct', 
  protect, 
  upload.single('file'), 
  uploadDirect
);

// Upload single file - for admin users
router.post('/admin/direct', 
  authenticateAdmin, 
  upload.single('file'), 
  uploadDirect
);

// Upload multiple files - for regular users
router.post('/multiple', 
  protect, 
  upload.array('files', 10), // Max 10 files at once
  uploadMultiple
);

// Upload multiple files - for admin users
router.post('/admin/multiple', 
  authenticateAdmin, 
  upload.array('files', 10), // Max 10 files at once
  uploadMultiple
);

export default router;