//@ts-nocheck
import express from 'express';
import {
  registerWithOtp,
  verifySignupOtp,
  resendOtp,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  loginWithOtpCheck,
} from '../controllers/auth.otp.controller';

const router = express.Router();

// Registration with OTP
router.post('/register', registerWithOtp);
router.post('/verify-signup', verifySignupOtp);

// OTP operations
router.post('/resend-otp', resendOtp);

// Password reset with OTP
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-reset-otp', verifyPasswordResetOtp);
router.post('/reset-password', resetPasswordWithOtp);

// Login with email verification check
router.post('/login', loginWithOtpCheck);

export default router;
