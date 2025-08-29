"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payout_controller_1 = require("../controllers/payout.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.protect);
// Get earnings history with pagination
router.get('/earnings/history', payout_controller_1.getEarningsHistory);
// Get earnings summary
router.get('/earnings/summary', payout_controller_1.getEarningsSummary);
// Get specific transaction details
router.get('/transactions/:transactionId', payout_controller_1.getTransactionDetails);
exports.default = router;
