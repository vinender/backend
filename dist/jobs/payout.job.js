"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPayoutJobs = void 0;
exports.processAutomaticTransfers = processAutomaticTransfers;
const node_cron_1 = __importDefault(require("node-cron"));
const refund_service_1 = __importDefault(require("../services/refund.service"));
const database_1 = __importDefault(require("../config/database"));
const notification_controller_1 = require("../controllers/notification.controller");
/**
 * Scheduled job to process payouts for completed bookings
 * Runs every hour to check for bookings that have passed their cancellation period
 */
const initPayoutJobs = () => {
    // Run every hour at minute 0
    node_cron_1.default.schedule('0 * * * *', async () => {
        console.log('Running scheduled payout job...');
        try {
            // Process payouts for completed bookings past cancellation period
            await refund_service_1.default.processCompletedBookingPayouts();
            // Also check for any failed payouts to retry
            await retryFailedPayouts();
            console.log('Payout job completed successfully');
        }
        catch (error) {
            console.error('Payout job error:', error);
        }
    });
    // Run daily at midnight to calculate and update field owner earnings
    node_cron_1.default.schedule('0 0 * * *', async () => {
        console.log('Running daily earnings calculation...');
        try {
            await calculateFieldOwnerEarnings();
            console.log('Earnings calculation completed');
        }
        catch (error) {
            console.error('Earnings calculation error:', error);
        }
    });
};
exports.initPayoutJobs = initPayoutJobs;
/**
 * Retry failed payouts
 */
async function retryFailedPayouts() {
    try {
        const failedPayouts = await database_1.default.payout.findMany({
            where: {
                status: 'failed',
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Only retry payouts from last 24 hours
                }
            },
            include: {
                stripeAccount: {
                    include: {
                        user: true
                    }
                }
            }
        });
        for (const payout of failedPayouts) {
            // Check if Stripe account is now ready
            if (!payout.stripeAccount.payoutsEnabled) {
                continue; // Skip if account still not ready
            }
            try {
                // Attempt to retry the payout
                const { stripe } = require('../config/stripe.config');
                const transfer = await stripe.transfers.create({
                    amount: Math.round(payout.amount * 100),
                    currency: payout.currency,
                    destination: payout.stripeAccount.stripeAccountId,
                    description: payout.description || `Retry payout ${payout.id}`,
                    metadata: {
                        payoutId: payout.id,
                        retryAttempt: 'true'
                    }
                });
                // Update payout status
                await database_1.default.payout.update({
                    where: { id: payout.id },
                    data: {
                        status: 'paid',
                        stripePayoutId: transfer.id,
                        arrivalDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
                    }
                });
                // Send success notification
                await (0, notification_controller_1.createNotification)({
                    userId: payout.stripeAccount.userId,
                    type: 'payout_retry_success',
                    title: 'Payout Processed',
                    message: `Your previously failed payout of $${payout.amount.toFixed(2)} has been successfully processed.`,
                    data: {
                        payoutId: payout.id,
                        amount: payout.amount
                    }
                });
                console.log(`Successfully retried payout ${payout.id}`);
            }
            catch (retryError) {
                console.error(`Failed to retry payout ${payout.id}:`, retryError);
                // Update failure reason
                await database_1.default.payout.update({
                    where: { id: payout.id },
                    data: {
                        failureMessage: retryError.message,
                        failureCode: retryError.code
                    }
                });
            }
        }
    }
    catch (error) {
        console.error('Retry failed payouts error:', error);
    }
}
/**
 * Calculate and update field owner earnings
 */
async function calculateFieldOwnerEarnings() {
    try {
        // Get all field owners
        const fieldOwners = await database_1.default.user.findMany({
            where: {
                role: 'FIELD_OWNER',
                stripeAccount: {
                    isNot: null
                }
            },
            include: {
                stripeAccount: true,
                ownedFields: {
                    include: {
                        bookings: {
                            where: {
                                OR: [
                                    { status: 'COMPLETED' },
                                    {
                                        status: 'CANCELLED',
                                        cancelledAt: {
                                            not: null
                                        }
                                    }
                                ]
                            },
                            include: {
                                payment: true
                            }
                        }
                    }
                }
            }
        });
        for (const owner of fieldOwners) {
            let totalEarnings = 0;
            let pendingEarnings = 0;
            let availableEarnings = 0;
            for (const field of owner.ownedFields) {
                for (const booking of field.bookings) {
                    if (!booking.payment)
                        continue;
                    const bookingAmount = booking.fieldOwnerAmount || (booking.totalPrice * 0.8); // 80% after platform fee
                    if (booking.payoutStatus === 'COMPLETED') {
                        totalEarnings += bookingAmount;
                        availableEarnings += bookingAmount;
                    }
                    else if (booking.payoutStatus === 'PROCESSING' || booking.payoutStatus === 'PENDING') {
                        pendingEarnings += bookingAmount;
                    }
                }
            }
            // Get all successful payouts
            const payouts = await database_1.default.payout.findMany({
                where: {
                    stripeAccountId: owner.stripeAccount.id,
                    status: 'paid'
                }
            });
            const totalPayouts = payouts.reduce((sum, payout) => sum + payout.amount, 0);
            // Update user's earning statistics (you may need to add these fields to User model)
            // For now, we'll store this in a notification
            await (0, notification_controller_1.createNotification)({
                userId: owner.id,
                type: 'earnings_update',
                title: 'Earnings Update',
                message: `Your current earnings: Total: $${totalEarnings.toFixed(2)}, Available: $${availableEarnings.toFixed(2)}, Pending: $${pendingEarnings.toFixed(2)}`,
                data: {
                    totalEarnings,
                    availableEarnings,
                    pendingEarnings,
                    totalPayouts
                }
            });
        }
    }
    catch (error) {
        console.error('Calculate earnings error:', error);
    }
}
/**
 * Process automatic transfers for bookings past cancellation period
 * This ensures field owners receive their share after 24 hours even if no cancellation occurred
 */
async function processAutomaticTransfers() {
    try {
        const eligibleBookings = await database_1.default.booking.findMany({
            where: {
                status: 'COMPLETED',
                payoutStatus: null,
                date: {
                    lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours after booking date
                }
            },
            include: {
                payment: true,
                field: {
                    include: {
                        owner: {
                            include: {
                                stripeAccount: true
                            }
                        }
                    }
                }
            }
        });
        for (const booking of eligibleBookings) {
            if (!booking.payment || booking.payment.status !== 'completed') {
                continue;
            }
            try {
                // Mark as processing to avoid duplicate processing
                await database_1.default.booking.update({
                    where: { id: booking.id },
                    data: { payoutStatus: 'PROCESSING' }
                });
                // Process the payout
                await refund_service_1.default.processFieldOwnerPayout(booking, 0);
                console.log(`Processed automatic transfer for booking ${booking.id}`);
            }
            catch (error) {
                console.error(`Failed to process transfer for booking ${booking.id}:`, error);
                // Revert status on error
                await database_1.default.booking.update({
                    where: { id: booking.id },
                    data: { payoutStatus: null }
                });
            }
        }
    }
    catch (error) {
        console.error('Process automatic transfers error:', error);
    }
}
