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
const _settingscontroller = require("../controllers/settings.controller");
const _authmiddleware = require("../middleware/auth.middleware");
const _adminmiddleware = require("../middleware/admin.middleware");
const router = (0, _express.Router)();
// Public route - get settings needed for frontend (no auth required)
router.get('/public', _settingscontroller.getPublicSettings);
// Admin routes
router.get('/admin', _adminmiddleware.authenticateAdmin, _settingscontroller.getSystemSettings);
router.put('/admin', _adminmiddleware.authenticateAdmin, _settingscontroller.updateSystemSettings);
router.put('/admin/platform-images', _adminmiddleware.authenticateAdmin, _settingscontroller.updatePlatformImages);
// Authenticated route for logged-in users to get certain settings
router.get('/user', _authmiddleware.protect, _settingscontroller.getPublicSettings);
const _default = router;

//# sourceMappingURL=settings.routes.js.map