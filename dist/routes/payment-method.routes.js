"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-nocheck
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const payment_method_controller_1 = require("../controllers/payment-method.controller");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.protect);
// Create setup intent for adding a new card
router.post('/setup-intent', payment_method_controller_1.paymentMethodController.createSetupIntent);
// Save payment method after successful setup
router.post('/save', payment_method_controller_1.paymentMethodController.savePaymentMethod);
// Get all payment methods for the user
router.get('/', payment_method_controller_1.paymentMethodController.getPaymentMethods);
// Set a payment method as default
router.put('/:paymentMethodId/set-default', payment_method_controller_1.paymentMethodController.setDefaultPaymentMethod);
// Delete a payment method
router.delete('/:paymentMethodId', payment_method_controller_1.paymentMethodController.deletePaymentMethod);
exports.default = router;
