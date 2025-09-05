"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const refund_service_1 = __importDefault(require("../services/refund.service"));
const payout_job_1 = require("../jobs/payout.job");
const router = (0, express_1.Router)();
// Require admin role for all routes
router.use(auth_middleware_1.protect);
router.use((0, role_middleware_1.requireRole)('ADMIN'));
// Manually trigger payout processing for testing
router.post('/process-payouts', async (req, res) => {
    try {
        console.log('Manually triggering payout processing...');
        // Process completed bookings past cancellation period
        await refund_service_1.default.processCompletedBookingPayouts();
        // Process automatic transfers
        await (0, payout_job_1.processAutomaticTransfers)();
        res.json({
            success: true,
            message: 'Payout processing triggered successfully'
        });
    }
    catch (error) {
        console.error('Manual payout trigger error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process payouts'
        });
    }
});
// Get payout statistics
router.get('/payout-stats', async (req, res) => {
    try {
        const prisma = (await Promise.resolve().then(() => __importStar(require('../config/database')))).default;
        // Get overall statistics
        const [totalPayouts, pendingPayouts, completedPayouts, failedPayouts] = await Promise.all([
            prisma.payout.count(),
            prisma.payout.count({ where: { status: 'pending' } }),
            prisma.payout.count({ where: { status: 'paid' } }),
            prisma.payout.count({ where: { status: 'failed' } })
        ]);
        // Get total amounts
        const [totalAmount, pendingAmount, paidAmount] = await Promise.all([
            prisma.payout.aggregate({
                _sum: { amount: true }
            }),
            prisma.payout.aggregate({
                where: { status: 'pending' },
                _sum: { amount: true }
            }),
            prisma.payout.aggregate({
                where: { status: 'paid' },
                _sum: { amount: true }
            })
        ]);
        // Get bookings awaiting payout
        const bookingsAwaitingPayout = await prisma.booking.count({
            where: {
                status: 'COMPLETED',
                payoutStatus: null,
                date: {
                    lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours old
                }
            }
        });
        res.json({
            success: true,
            stats: {
                payouts: {
                    total: totalPayouts,
                    pending: pendingPayouts,
                    completed: completedPayouts,
                    failed: failedPayouts
                },
                amounts: {
                    total: totalAmount._sum.amount || 0,
                    pending: pendingAmount._sum.amount || 0,
                    paid: paidAmount._sum.amount || 0
                },
                bookingsAwaitingPayout
            }
        });
    }
    catch (error) {
        console.error('Payout stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get payout statistics'
        });
    }
});
exports.default = router;
