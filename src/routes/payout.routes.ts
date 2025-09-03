import express from 'express';
import { 
  getEarningsHistory, 
  getEarningsSummary, 
  getTransactionDetails,
  processPendingPayouts,
  getPayoutHistory,
  triggerBookingPayout
} from '../controllers/payout.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get earnings history with pagination
router.get('/earnings/history', getEarningsHistory);

// Get earnings summary
router.get('/earnings/summary', getEarningsSummary);

// Get specific transaction details
router.get('/transactions/:transactionId', getTransactionDetails);

// Process pending payouts for field owner (after Stripe setup)
router.post('/process-pending', restrictTo('FIELD_OWNER'), processPendingPayouts);

// Get payout history
router.get('/history', getPayoutHistory);

// Manually trigger payout for a booking (Admin only)
router.post('/trigger/:bookingId', restrictTo('ADMIN'), triggerBookingPayout);

export default router;