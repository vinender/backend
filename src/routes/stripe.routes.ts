import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import express from 'express';

const router = Router();
const paymentController = new PaymentController();

// Stripe webhook endpoint - raw body needed
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

export default router;