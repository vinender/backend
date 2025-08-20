"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const field_controller_1 = __importDefault(require("../controllers/field.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const auth_middleware_2 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes (with optional auth for better data)
router.get('/', auth_middleware_2.optionalAuth, field_controller_1.default.getAllFields);
router.get('/search/location', field_controller_1.default.searchByLocation);
router.get('/:id', auth_middleware_2.optionalAuth, field_controller_1.default.getField);
// Protected routes (require authentication)
router.use(auth_middleware_1.protect);
// Field owner routes
router.get('/owner/field', (0, auth_middleware_1.restrictTo)('FIELD_OWNER'), field_controller_1.default.getOwnerField);
router.get('/owner/bookings', (0, auth_middleware_1.restrictTo)('FIELD_OWNER'), field_controller_1.default.getFieldBookings);
router.post('/save-progress', (0, auth_middleware_1.restrictTo)('FIELD_OWNER'), field_controller_1.default.saveFieldProgress);
router.post('/submit-for-review', (0, auth_middleware_1.restrictTo)('FIELD_OWNER'), field_controller_1.default.submitFieldForReview);
router.get('/my-fields', (0, auth_middleware_1.restrictTo)('FIELD_OWNER', 'ADMIN'), field_controller_1.default.getMyFields);
router.post('/', (0, auth_middleware_1.restrictTo)('FIELD_OWNER', 'ADMIN'), field_controller_1.default.createField);
// Field management routes
router
    .route('/:id')
    .patch((0, auth_middleware_1.restrictTo)('FIELD_OWNER', 'ADMIN'), field_controller_1.default.updateField)
    .delete((0, auth_middleware_1.restrictTo)('FIELD_OWNER', 'ADMIN'), field_controller_1.default.deleteField);
// Toggle field active status
router.patch('/:id/toggle-status', (0, auth_middleware_1.restrictTo)('FIELD_OWNER', 'ADMIN'), field_controller_1.default.toggleFieldStatus);
exports.default = router;
