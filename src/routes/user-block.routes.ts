import { Router } from 'express';
import { userBlockController } from '../controllers/user-block.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Block a user
router.post('/block', protect, userBlockController.blockUser);

// Unblock a user
router.post('/unblock', protect, userBlockController.unblockUser);

// Get list of blocked users
router.get('/blocked', protect, userBlockController.getBlockedUsers);

// Get list of users who blocked you
router.get('/blocked-by', protect, userBlockController.getBlockedByUsers);

// Check block status between two users
router.get('/status/:otherUserId', protect, userBlockController.checkBlockStatus);

export default router;