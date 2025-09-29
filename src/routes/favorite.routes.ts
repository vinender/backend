//@ts-nocheck
import { Router } from 'express';
import favoriteController from '../controllers/favorite.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and DOG_OWNER role
router.use(protect);
router.use(restrictTo('DOG_OWNER'));

// Toggle favorite (save/unsave)
router.post('/toggle/:fieldId', favoriteController.toggleFavorite);

// Get user's saved fields
router.get('/my-saved-fields', favoriteController.getSavedFields);

// Check if field is favorited
router.get('/check/:fieldId', favoriteController.checkFavorite);

// Remove from favorites
router.delete('/:fieldId', favoriteController.removeFavorite);

export default router;
