//@ts-nocheck
import { Router } from 'express';
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
import { authenticateAdmin } from '../middleware/admin.middleware';

const router = Router();

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
