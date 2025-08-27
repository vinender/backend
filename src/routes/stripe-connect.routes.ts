import { Router } from 'express';
import { protect, restrictTo } from '../middleware/auth.middleware';
import stripeConnectController from '../controllers/stripe-connect.controller';

const router = Router();

// All routes require authentication and field owner role
router.use(protect);
router.use(restrictTo('FIELD_OWNER'));

// Stripe Connect account management
router.post('/create-account', stripeConnectController.createConnectAccount);
router.post('/onboarding-link', stripeConnectController.getOnboardingLink);
router.get('/account-status', stripeConnectController.getAccountStatus);
router.get('/balance', stripeConnectController.getBalance);

// Bank account management  
router.post('/update-bank', stripeConnectController.updateBankAccount);
router.delete('/disconnect', stripeConnectController.disconnectAccount);

// Payouts
router.post('/payout', stripeConnectController.createPayout);
router.get('/payout-history', stripeConnectController.getPayoutHistory);

export default router;