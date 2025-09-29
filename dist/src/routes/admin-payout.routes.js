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
const _authmiddleware = require("../middleware/auth.middleware");
const _rolemiddleware = require("../middleware/role.middleware");
const _refundservice = /*#__PURE__*/ _interop_require_default(require("../services/refund.service"));
const _payoutjob = require("../jobs/payout.job");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const router = (0, _express.Router)();
// Require admin role for all routes
router.use(_authmiddleware.protect);
router.use((0, _rolemiddleware.requireRole)('ADMIN'));
// Manually trigger payout processing for testing
router.post('/process-payouts', async (req, res)=>{
    try {
        console.log('Manually triggering payout processing...');
        // Process completed bookings past cancellation period
        await _refundservice.default.processCompletedBookingPayouts();
        // Process automatic transfers
        await (0, _payoutjob.processAutomaticTransfers)();
        res.json({
            success: true,
            message: 'Payout processing triggered successfully'
        });
    } catch (error) {
        console.error('Manual payout trigger error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process payouts'
        });
    }
});
// Get payout statistics
router.get('/payout-stats', async (req, res)=>{
    try {
        const prisma = (await Promise.resolve().then(()=>/*#__PURE__*/ _interop_require_wildcard(require("../config/database")))).default;
        // Get overall statistics
        const [totalPayouts, pendingPayouts, completedPayouts, failedPayouts] = await Promise.all([
            prisma.payout.count(),
            prisma.payout.count({
                where: {
                    status: 'pending'
                }
            }),
            prisma.payout.count({
                where: {
                    status: 'paid'
                }
            }),
            prisma.payout.count({
                where: {
                    status: 'failed'
                }
            })
        ]);
        // Get total amounts
        const [totalAmount, pendingAmount, paidAmount] = await Promise.all([
            prisma.payout.aggregate({
                _sum: {
                    amount: true
                }
            }),
            prisma.payout.aggregate({
                where: {
                    status: 'pending'
                },
                _sum: {
                    amount: true
                }
            }),
            prisma.payout.aggregate({
                where: {
                    status: 'paid'
                },
                _sum: {
                    amount: true
                }
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
    } catch (error) {
        console.error('Payout stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get payout statistics'
        });
    }
});
const _default = router;

//# sourceMappingURL=admin-payout.routes.js.map