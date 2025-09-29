"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-nocheck
const express_1 = require("express");
const about_page_controller_1 = require("../controllers/about-page.controller");
const admin_middleware_1 = require("../middleware/admin.middleware");
const router = (0, express_1.Router)();
// Public route - anyone can view about page
router.get('/', about_page_controller_1.getAboutPage);
// Admin only routes for updating
router.put('/', admin_middleware_1.authenticateAdmin, about_page_controller_1.updateAboutPage);
router.put('/section/:section', admin_middleware_1.authenticateAdmin, about_page_controller_1.updateAboutSection);
exports.default = router;
