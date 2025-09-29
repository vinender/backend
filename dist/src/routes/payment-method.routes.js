"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _express = require("express");
const _authmiddleware = require("../middleware/auth.middleware");
const _paymentmethodcontroller = require("../controllers/payment-method.controller");
const router = (0, _express.Router)();
// All routes require authentication
router.use(_authmiddleware.protect);
// Create setup intent for adding a new card
router.post('/setup-intent', _paymentmethodcontroller.paymentMethodController.createSetupIntent);
// Save payment method after successful setup
router.post('/save', _paymentmethodcontroller.paymentMethodController.savePaymentMethod);
// Get all payment methods for the user
router.get('/', _paymentmethodcontroller.paymentMethodController.getPaymentMethods);
// Set a payment method as default
router.put('/:paymentMethodId/set-default', _paymentmethodcontroller.paymentMethodController.setDefaultPaymentMethod);
// Delete a payment method
router.delete('/:paymentMethodId', _paymentmethodcontroller.paymentMethodController.deletePaymentMethod);
const _default = router;

//# sourceMappingURL=payment-method.routes.js.map