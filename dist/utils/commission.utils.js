"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveCommissionRate = getEffectiveCommissionRate;
exports.calculatePayoutAmounts = calculatePayoutAmounts;
//@ts-nocheck
const database_1 = __importDefault(require("../config/database"));
/**
 * Get the effective commission rate for a field owner
 * Returns the custom rate if set, otherwise the system default
 * Also returns whether a custom rate was used and the default rate for auditing
 */
async function getEffectiveCommissionRate(userId) {
    try {
        // Get the field owner's custom commission rate
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            select: { commissionRate: true }
        });
        // Get the system default
        const settings = await database_1.default.systemSettings.findFirst();
        const defaultRate = settings?.defaultCommissionRate || 20;
        // If user has a custom rate, use it
        if (user?.commissionRate !== null && user?.commissionRate !== undefined) {
            return {
                effectiveRate: user.commissionRate,
                isCustomRate: true,
                defaultRate
            };
        }
        // Otherwise, use the system default
        return {
            effectiveRate: defaultRate,
            isCustomRate: false,
            defaultRate
        };
    }
    catch (error) {
        console.error('Error getting commission rate:', error);
        // Return default 20% on error
        return {
            effectiveRate: 20,
            isCustomRate: false,
            defaultRate: 20
        };
    }
}
/**
 * Calculate field owner amount and platform fee based on commission rate
 *
 * Commission rate represents what the FIELD OWNER receives as a percentage.
 * Example: If dog owner pays £100, Stripe takes £1 (1%), leaving £99.
 * With 20% commission rate: Field owner gets 20% of £99 = £19.80
 * Platform gets the remaining 80% = £79.20
 */
async function calculatePayoutAmounts(totalAmount, fieldOwnerId) {
    const { effectiveRate, isCustomRate, defaultRate } = await getEffectiveCommissionRate(fieldOwnerId);
    // Field owner gets the commission percentage (their earnings)
    const fieldOwnerAmount = (totalAmount * effectiveRate) / 100;
    // Platform gets the remaining amount after field owner's commission
    const platformFeeAmount = totalAmount - fieldOwnerAmount;
    const platformCommission = platformFeeAmount; // Same value, different name for DB compatibility
    return {
        fieldOwnerAmount,
        platformFeeAmount,
        platformCommission, // DB field name
        commissionRate: effectiveRate,
        isCustomCommission: isCustomRate,
        defaultCommissionRate: defaultRate
    };
}
