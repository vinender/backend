import { Router } from 'express';
import fieldPropertiesController from '../controllers/field-properties.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Public routes - Get all field properties with their options
router.get('/', fieldPropertiesController.getAllFieldProperties); // GET /field-properties - returns all properties
router.get('/:property', fieldPropertiesController.getFieldOptionsByProperty); // GET /field-properties/:property

// Admin routes - Manage field properties
router.get('/admin/all', protect, fieldPropertiesController.getAllFieldPropertiesAdmin);
router.post('/admin', protect, fieldPropertiesController.createFieldOption);
router.put('/admin/:id', protect, fieldPropertiesController.updateFieldOption);
router.delete('/admin/:id', protect, fieldPropertiesController.deleteFieldOption);
router.post('/admin/bulk-order', protect, fieldPropertiesController.updateFieldPropertiesOrder);

export default router;
