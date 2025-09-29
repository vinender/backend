//@ts-nocheck
import { Router } from 'express';
import reviewController from '../controllers/review.controller';
import { protect } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import {
  createReviewSchema,
  updateReviewSchema,
  respondToReviewSchema,
  getReviewsQuerySchema,
} from '../validations/review.validation';

const router = Router();

// Public routes
router.get(
  '/field/:fieldId',
  validateRequest(getReviewsQuerySchema),
  reviewController.getFieldReviews
);

// Protected routes
router.use(protect);

// Create a review
router.post(
  '/field/:fieldId',
  validateRequest(createReviewSchema),
  reviewController.createReview
);

// Update a review
router.put(
  '/:reviewId',
  validateRequest(updateReviewSchema),
  reviewController.updateReview
);

// Delete a review
router.delete('/:reviewId', reviewController.deleteReview);

// Mark review as helpful
router.post('/:reviewId/helpful', reviewController.markHelpful);

// Field owner response
router.post(
  '/:reviewId/response',
  validateRequest(respondToReviewSchema),
  reviewController.respondToReview
);

// Get user's reviews
router.get('/user/:userId?', reviewController.getUserReviews);

export default router;
