import express from 'express';
import {
  submitFieldClaim,
  getAllClaims,
  getClaimById,
  updateClaimStatus,
  getFieldClaims
} from '../controllers/claim.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = express.Router();

// Public routes
router.post('/submit', submitFieldClaim);

// Protected routes
router.use(protect);

// Get claims for a specific field
router.get('/field/:fieldId', getFieldClaims);

// Admin only routes
router.get('/', restrictTo('ADMIN'), getAllClaims);
router.get('/:claimId', restrictTo('ADMIN'), getClaimById);
router.patch('/:claimId/status', restrictTo('ADMIN'), updateClaimStatus);

export default router;