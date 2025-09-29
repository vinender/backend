//@ts-nocheck
import { Router } from 'express';
import autoPayoutController from '../controllers/auto-payout.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// Field owner routes
router.get('/summary', restrictTo('FIELD_OWNER', 'ADMIN'), autoPayoutController.getPayoutSummary);

// Admin routes
router.post('/trigger', restrictTo('ADMIN'), autoPayoutController.triggerPayoutProcessing);
router.post('/process/:bookingId', restrictTo('ADMIN'), autoPayoutController.processBookingPayout);

// Refund with fee adjustment (Admin or booking owner)
router.post('/refund/:bookingId', autoPayoutController.processRefundWithFees);

export default router;
