import express from 'express';
import { 
  getEarningsHistory, 
  getEarningsSummary, 
  getTransactionDetails 
} from '../controllers/payout.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get earnings history with pagination
router.get('/earnings/history', getEarningsHistory);

// Get earnings summary
router.get('/earnings/summary', getEarningsSummary);

// Get specific transaction details
router.get('/transactions/:transactionId', getTransactionDetails);

export default router;