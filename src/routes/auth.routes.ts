import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { registerSchema, loginSchema } from '../validations/auth.validation';

const router = Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working' });
});

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);


export default router;