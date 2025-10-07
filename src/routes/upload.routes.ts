//@ts-nocheck
import { Router } from 'express';
import { uploadDirect, uploadMultiple, upload, getPresignedUrl } from '../controllers/upload.controller';
import { protect } from '../middleware/auth.middleware';
import { authenticateAdmin } from '../middleware/admin.middleware';

const router = Router();

// Upload single file - generic endpoint (accepts both user and admin auth)
router.post('/single',
  authenticateAdmin, // Use admin auth for admin panel
  upload.single('file'),
  uploadDirect
);

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

// Generate presigned URL for direct browser upload
router.post('/presigned-url',
  protect,
  getPresignedUrl
);

// Generate presigned URL for admin
router.post('/admin/presigned-url',
  authenticateAdmin,
  getPresignedUrl
);

export default router;
