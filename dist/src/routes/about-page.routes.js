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
const _aboutpagecontroller = require("../controllers/about-page.controller");
const _adminmiddleware = require("../middleware/admin.middleware");
const router = (0, _express.Router)();
// Public route - anyone can view about page
router.get('/', _aboutpagecontroller.getAboutPage);
// Admin only routes for updating
router.put('/', _adminmiddleware.authenticateAdmin, _aboutpagecontroller.updateAboutPage);
router.put('/section/:section', _adminmiddleware.authenticateAdmin, _aboutpagecontroller.updateAboutSection);
const _default = router;

//# sourceMappingURL=about-page.routes.js.map