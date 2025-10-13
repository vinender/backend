//@ts-nocheck
import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { paymentMethodController } from '../controllers/payment-method.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Create setup intent for adding a new card
router.post('/setup-intent', paymentMethodController.createSetupIntent);

// Get all payment methods for the user
router.get('/', paymentMethodController.getPaymentMethods);

// Save payment method after successful setup (RESTful: POST to collection endpoint)
router.post('/', paymentMethodController.savePaymentMethod);

// DEPRECATED: Backward compatibility for old /save endpoint (remove after frontend migration)
router.post('/save', paymentMethodController.savePaymentMethod);

// Set a payment method as default
router.patch('/:paymentMethodId/set-default', paymentMethodController.setDefaultPaymentMethod);

// Delete a payment method
router.delete('/:paymentMethodId', paymentMethodController.deletePaymentMethod);

export default router;
