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
const _bookingcontroller = /*#__PURE__*/ _interop_require_default(require("../controllers/booking.controller"));
const _authmiddleware = require("../middleware/auth.middleware");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const router = (0, _express.Router)();
// Public routes to check availability
router.get('/availability', _bookingcontroller.default.checkAvailability);
router.get('/fields/:fieldId/slot-availability', _bookingcontroller.default.getSlotAvailability);
// All routes below require authentication
router.use(_authmiddleware.protect);
// Dog owner and field owner routes
router.get('/my-bookings', _bookingcontroller.default.getMyBookings);
router.get('/my-recurring', _bookingcontroller.default.getMyRecurringBookings);
router.get('/stats', _bookingcontroller.default.getBookingStats);
router.post('/', _bookingcontroller.default.createBooking);
router.post('/:id/cancel-recurring', _bookingcontroller.default.cancelRecurringBooking);
// Admin routes
router.get('/', (0, _authmiddleware.restrictTo)('ADMIN'), _bookingcontroller.default.getAllBookings);
router.post('/mark-completed', (0, _authmiddleware.restrictTo)('ADMIN'), _bookingcontroller.default.markPastBookingsAsCompleted);
// Booking specific routes
router.route('/:id').get(_bookingcontroller.default.getBooking).patch(_bookingcontroller.default.updateBooking).delete((0, _authmiddleware.restrictTo)('ADMIN'), _bookingcontroller.default.deleteBooking);
// Booking status management
router.patch('/:id/status', _bookingcontroller.default.updateBookingStatus);
router.get('/:id/refund-eligibility', _bookingcontroller.default.checkRefundEligibility);
router.patch('/:id/cancel', _bookingcontroller.default.cancelBooking);
const _default = router;

//# sourceMappingURL=booking.routes.js.map