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
const _fieldcontroller = /*#__PURE__*/ _interop_require_default(require("../controllers/field.controller"));
const _authmiddleware = require("../middleware/auth.middleware");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const router = (0, _express.Router)();
// Public routes (with optional auth for better data)
router.get('/', _authmiddleware.optionalAuth, _fieldcontroller.default.getAllFields);
router.get('/suggestions', _fieldcontroller.default.getFieldSuggestions);
router.get('/search/location', _fieldcontroller.default.searchByLocation);
// Field ownership claiming routes (for field owners to claim unclaimed fields)
// These are NOT for booking - they're for claiming ownership of unclaimed fields
router.get('/unclaimed', _authmiddleware.protect, (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.getFieldForClaim);
router.post('/claim-ownership', _authmiddleware.protect, (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.claimField);
// Public route with ID parameter (must come after specific routes)
router.get('/:id', _authmiddleware.optionalAuth, _fieldcontroller.default.getField);
// All remaining routes require authentication
router.use(_authmiddleware.protect);
// Field owner routes
router.get('/owner/field', (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.getOwnerField);
router.get('/owner/bookings', (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.getFieldBookings);
router.get('/owner/bookings/recent', (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.getRecentBookings);
router.get('/owner/bookings/today', (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.getTodayBookings);
router.get('/owner/bookings/upcoming', (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.getUpcomingBookings);
router.get('/owner/bookings/previous', (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.getPreviousBookings);
router.post('/save-progress', (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.saveFieldProgress);
router.post('/submit-for-review', (0, _authmiddleware.restrictTo)('FIELD_OWNER'), _fieldcontroller.default.submitFieldForReview);
router.get('/my-fields', (0, _authmiddleware.restrictTo)('FIELD_OWNER', 'ADMIN'), _fieldcontroller.default.getMyFields);
router.post('/', (0, _authmiddleware.restrictTo)('FIELD_OWNER', 'ADMIN'), _fieldcontroller.default.createField);
// Field management routes
router.route('/:id').patch((0, _authmiddleware.restrictTo)('FIELD_OWNER', 'ADMIN'), _fieldcontroller.default.updateField).delete((0, _authmiddleware.restrictTo)('FIELD_OWNER', 'ADMIN'), _fieldcontroller.default.deleteField);
// Toggle field active status
router.patch('/:id/toggle-status', (0, _authmiddleware.restrictTo)('FIELD_OWNER', 'ADMIN'), _fieldcontroller.default.toggleFieldStatus);
const _default = router;

//# sourceMappingURL=field.routes.js.map