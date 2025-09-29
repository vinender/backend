"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-nocheck
const express_1 = require("express");
const faq_controller_1 = require("../controllers/faq.controller");
const admin_middleware_1 = require("../middleware/admin.middleware");
const router = (0, express_1.Router)();
// Public routes
router.get('/public', faq_controller_1.getFAQs); // Get active FAQs for public display
// Admin routes
router.get('/admin', admin_middleware_1.authenticateAdmin, faq_controller_1.getAllFAQs); // Get all FAQs including inactive
router.get('/admin/:id', admin_middleware_1.authenticateAdmin, faq_controller_1.getFAQ); // Get single FAQ
router.post('/admin', admin_middleware_1.authenticateAdmin, faq_controller_1.createFAQ); // Create new FAQ
router.put('/admin/:id', admin_middleware_1.authenticateAdmin, faq_controller_1.updateFAQ); // Update FAQ
router.delete('/admin/:id', admin_middleware_1.authenticateAdmin, faq_controller_1.deleteFAQ); // Delete FAQ
router.post('/admin/bulk', admin_middleware_1.authenticateAdmin, faq_controller_1.bulkUpsertFAQs); // Bulk create/update
router.put('/admin/reorder', admin_middleware_1.authenticateAdmin, faq_controller_1.reorderFAQs); // Reorder FAQs
exports.default = router;
