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
const _faqcontroller = require("../controllers/faq.controller");
const _adminmiddleware = require("../middleware/admin.middleware");
const router = (0, _express.Router)();
// Public routes
router.get('/public', _faqcontroller.getFAQs); // Get active FAQs for public display
// Admin routes
router.get('/admin', _adminmiddleware.authenticateAdmin, _faqcontroller.getAllFAQs); // Get all FAQs including inactive
router.get('/admin/:id', _adminmiddleware.authenticateAdmin, _faqcontroller.getFAQ); // Get single FAQ
router.post('/admin', _adminmiddleware.authenticateAdmin, _faqcontroller.createFAQ); // Create new FAQ
router.put('/admin/:id', _adminmiddleware.authenticateAdmin, _faqcontroller.updateFAQ); // Update FAQ
router.delete('/admin/:id', _adminmiddleware.authenticateAdmin, _faqcontroller.deleteFAQ); // Delete FAQ
router.post('/admin/bulk', _adminmiddleware.authenticateAdmin, _faqcontroller.bulkUpsertFAQs); // Bulk create/update
router.put('/admin/reorder', _adminmiddleware.authenticateAdmin, _faqcontroller.reorderFAQs); // Reorder FAQs
const _default = router;

//# sourceMappingURL=faq.routes.js.map