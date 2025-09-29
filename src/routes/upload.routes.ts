//@ts-nocheck
import { Router } from 'express';
import { uploadDirect, uploadMultiple, upload } from '../controllers/upload.controller';
import { protect } from '../middleware/auth.middleware';
import { authenticateAdmin } from '../middleware/admin.middleware';

const router = Router();

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
