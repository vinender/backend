"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get calculatePayoutAmounts () {
        return calculatePayoutAmounts;
    },
    get getEffectiveCommissionRate () {
        return getEffectiveCommissionRate;
    }
});
const _database = /*#__PURE__*/ _interop_require_default(require("../config/database"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
async function getEffectiveCommissionRate(userId) {
    try {
        // Get the field owner's custom commission rate
        const user = await _database.default.user.findUnique({
            where: {
                id: userId
            },
            select: {
                commissionRate: true
            }
        });
        // If user has a custom rate, use it
        if (user?.commissionRate !== null && user?.commissionRate !== undefined) {
            return user.commissionRate;
        }
        // Otherwise, get the system default
        const settings = await _database.default.systemSettings.findFirst();
        // Return the default rate or 20% if no settings exist
        return settings?.defaultCommissionRate || 20;
    } catch (error) {
        console.error('Error getting commission rate:', error);
        // Return default 20% on error
        return 20;
    }
}
async function calculatePayoutAmounts(totalAmount, fieldOwnerId) {
    const commissionRate = await getEffectiveCommissionRate(fieldOwnerId);
    // Platform gets the commission percentage
    const platformFeeAmount = totalAmount * commissionRate / 100;
    // Field owner gets the remaining amount
    const fieldOwnerAmount = totalAmount - platformFeeAmount;
    return {
        fieldOwnerAmount,
        platformFeeAmount,
        commissionRate
    };
}

//# sourceMappingURL=commission.utils.js.map