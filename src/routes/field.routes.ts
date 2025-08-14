import { Router } from 'express';
import fieldController from '../controllers/field.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// Public routes (with optional auth for better data)
router.get('/', optionalAuth, fieldController.getAllFields);
router.get('/search/location', fieldController.searchByLocation);
router.get('/:id', optionalAuth, fieldController.getField);

// Protected routes (require authentication)
router.use(protect);

// Field owner routes
router.get('/owner/field', restrictTo('FIELD_OWNER'), fieldController.getOwnerField);
router.get('/owner/bookings', restrictTo('FIELD_OWNER'), fieldController.getFieldBookings);
router.post('/save-progress', restrictTo('FIELD_OWNER'), fieldController.saveFieldProgress);
router.post('/submit-for-review', restrictTo('FIELD_OWNER'), fieldController.submitFieldForReview);
router.get('/my-fields', restrictTo('FIELD_OWNER', 'ADMIN'), fieldController.getMyFields);
router.post('/', restrictTo('FIELD_OWNER', 'ADMIN'), fieldController.createField);

// Field management routes
router
  .route('/:id')
  .patch(restrictTo('FIELD_OWNER', 'ADMIN'), fieldController.updateField)
  .delete(restrictTo('FIELD_OWNER', 'ADMIN'), fieldController.deleteField);

// Toggle field active status
router.patch('/:id/toggle-status', restrictTo('FIELD_OWNER', 'ADMIN'), fieldController.toggleFieldStatus);

export default router;