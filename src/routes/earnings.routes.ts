//@ts-nocheck
import { Router } from 'express';
import earningsController from '../controllers/earnings.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// Field owner routes
router.get('/dashboard', restrictTo('FIELD_OWNER', 'ADMIN'), earningsController.getEarningsDashboard);
router.get('/payout-history', restrictTo('FIELD_OWNER', 'ADMIN'), earningsController.getPayoutHistory);
router.get('/held-payouts', restrictTo('FIELD_OWNER', 'ADMIN'), earningsController.getHeldPayouts);
router.get('/export', restrictTo('FIELD_OWNER', 'ADMIN'), earningsController.exportPayoutHistory);

export default router;
