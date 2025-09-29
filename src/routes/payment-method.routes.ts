//@ts-nocheck
import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { paymentMethodController } from '../controllers/payment-method.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Create setup intent for adding a new card
router.post('/setup-intent', paymentMethodController.createSetupIntent);

// Save payment method after successful setup
router.post('/save', paymentMethodController.savePaymentMethod);

// Get all payment methods for the user
router.get('/', paymentMethodController.getPaymentMethods);

// Set a payment method as default
router.put('/:paymentMethodId/set-default', paymentMethodController.setDefaultPaymentMethod);

// Delete a payment method
router.delete('/:paymentMethodId', paymentMethodController.deletePaymentMethod);

export default router;
