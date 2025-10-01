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
 */
async function getEffectiveCommissionRate(userId) {
    try {
        // Get the field owner's custom commission rate
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            select: { commissionRate: true }
        });
        // If user has a custom rate, use it
        if (user?.commissionRate !== null && user?.commissionRate !== undefined) {
            return user.commissionRate;
        }
        // Otherwise, get the system default
        const settings = await database_1.default.systemSettings.findFirst();
        // Return the default rate or 20% if no settings exist
        return settings?.defaultCommissionRate || 20;
    }
    catch (error) {
        console.error('Error getting commission rate:', error);
        // Return default 20% on error
        return 20;
    }
}
/**
 * Calculate field owner amount and platform fee based on commission rate
 */
async function calculatePayoutAmounts(totalAmount, fieldOwnerId) {
    const commissionRate = await getEffectiveCommissionRate(fieldOwnerId);
    // Platform gets the commission percentage
    const platformFeeAmount = (totalAmount * commissionRate) / 100;
    const platformCommission = platformFeeAmount; // Same value, different name for DB compatibility
    // Field owner gets the remaining amount
    const fieldOwnerAmount = totalAmount - platformFeeAmount;
    return {
        fieldOwnerAmount,
        platformFeeAmount,
        platformCommission, // DB field name
        commissionRate
    };
}
