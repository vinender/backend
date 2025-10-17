"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutService = exports.PayoutService = void 0;
//@ts-nocheck
const client_1 = require("@prisma/client");
const stripe_1 = __importDefault(require("stripe"));
const notification_controller_1 = require("../controllers/notification.controller");
const commission_utils_1 = require("../utils/commission.utils");
const prisma = new client_1.PrismaClient();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-07-30.basil'
});
class PayoutService {
    /**
     * Process automatic payout when booking is completed
     * This transfers the field owner's portion from the platform account to their connected account
     */
    async processBookingPayout(bookingId) {
        try {
            // Get booking with field and owner details
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    field: {
                        include: {
                            owner: true
                        }
                    },
                    user: true
                }
            });
            if (!booking) {
                throw new Error('Booking not found');
            }
            // Check if payout has already been processed or is held
            if (booking.payoutStatus === 'COMPLETED' || booking.payoutStatus === 'PROCESSING') {
                console.log(`Payout already ${booking.payoutStatus} for booking ${bookingId}`);
                return;
            }
            // Check if payout is held (e.g., no Stripe account)
            if (booking.payoutStatus === 'HELD') {
                console.log(`Payout is held for booking ${bookingId}. Reason: ${booking.payoutHeldReason}`);
                return;
            }
            // Check if booking is completed and payment was successful
            if (booking.status !== 'COMPLETED' || booking.paymentStatus !== 'PAID') {
                console.log(`Booking ${bookingId} is not eligible for payout. Status: ${booking.status}, Payment: ${booking.paymentStatus}`);
                return;
            }
            const field = booking.field;
            const fieldOwner = field.owner;
            if (!fieldOwner) {
                throw new Error('Field owner not found');
            }
            // Check if field owner has a connected Stripe account
            const stripeAccount = await prisma.stripeAccount.findUnique({
                where: { userId: fieldOwner.id }
            });
            if (!stripeAccount) {
                console.log(`Field owner ${fieldOwner.id} does not have a Stripe account`);
                // Notify field owner to set up Stripe account
                // Calculate field owner amount if not stored
                const { fieldOwnerAmount: calculatedAmount } = await (0, commission_utils_1.calculatePayoutAmounts)(booking.totalPrice, fieldOwner.id);
                const payoutAmount = booking.fieldOwnerAmount || calculatedAmount;
                await (0, notification_controller_1.createNotification)({
                    userId: fieldOwner.id,
                    type: 'PAYOUT_PENDING',
                    title: 'Set up payment account',
                    message: 'You have pending payouts. Please set up your payment account to receive funds.',
                    data: {
                        bookingId,
                        amount: payoutAmount
                    }
                });
                // Mark payout as pending account setup
                await prisma.booking.update({
                    where: { id: bookingId },
                    data: { payoutStatus: 'PENDING_ACCOUNT' }
                });
                return;
            }
            // Check if Stripe account is fully onboarded
            if (!stripeAccount.chargesEnabled || !stripeAccount.payoutsEnabled) {
                console.log(`Field owner ${fieldOwner.id} Stripe account is not fully set up`);
                // Calculate field owner amount if not stored
                const { fieldOwnerAmount: calculatedAmount } = await (0, commission_utils_1.calculatePayoutAmounts)(booking.totalPrice, fieldOwner.id);
                const payoutAmount = booking.fieldOwnerAmount || calculatedAmount;
                // Notify field owner to complete Stripe onboarding
                await (0, notification_controller_1.createNotification)({
                    userId: fieldOwner.id,
                    type: 'PAYOUT_PENDING',
                    title: 'Complete payment account setup',
                    message: 'Please complete your payment account setup to receive pending payouts.',
                    data: {
                        bookingId,
                        amount: payoutAmount
                    }
                });
                // Mark payout as pending account setup
                await prisma.booking.update({
                    where: { id: bookingId },
                    data: { payoutStatus: 'PENDING_ACCOUNT' }
                });
                return;
            }
            // Get payout amount - use stored value or calculate
            let payoutAmount = booking.fieldOwnerAmount;
            let platformCommission = booking.platformCommission;
            if (!payoutAmount) {
                // Calculate if not stored (fallback for old bookings)
                const calculated = await (0, commission_utils_1.calculatePayoutAmounts)(booking.totalPrice, fieldOwner.id);
                payoutAmount = calculated.fieldOwnerAmount;
                platformCommission = calculated.platformCommission;
            }
            const payoutAmountInCents = Math.round(payoutAmount * 100);
            // Update booking to processing
            await prisma.booking.update({
                where: { id: bookingId },
                data: { payoutStatus: 'PROCESSING' }
            });
            try {
                // Create a transfer to the connected account
                const transfer = await stripe.transfers.create({
                    amount: payoutAmountInCents,
                    currency: 'eur',
                    destination: stripeAccount.stripeAccountId,
                    transfer_group: `booking_${bookingId}`,
                    metadata: {
                        bookingId,
                        fieldId: field.id,
                        fieldOwnerId: fieldOwner.id,
                        type: 'booking_payout'
                    },
                    description: `Payout for booking ${bookingId} - ${field.name}`
                });
                // Create payout record in database
                const payout = await prisma.payout.create({
                    data: {
                        stripeAccountId: stripeAccount.id,
                        stripePayoutId: transfer.id,
                        amount: payoutAmount,
                        currency: 'eur',
                        status: 'paid',
                        method: 'standard',
                        description: `Payout for booking ${bookingId}`,
                        bookingIds: [bookingId],
                        arrivalDate: new Date() // Transfers are typically instant to connected accounts
                    }
                });
                // Update booking with payout details and commission amounts
                await prisma.booking.update({
                    where: { id: bookingId },
                    data: {
                        payoutStatus: 'COMPLETED',
                        payoutId: payout.id,
                        fieldOwnerAmount: payoutAmount,
                        platformCommission: platformCommission
                    }
                });
                // Send notification to field owner
                await (0, notification_controller_1.createNotification)({
                    userId: fieldOwner.id,
                    type: 'PAYOUT_PROCESSED',
                    title: 'Payment Received!',
                    message: `£${payoutAmount.toFixed(2)} has been transferred to your account for ${field.name} booking.`,
                    data: {
                        bookingId,
                        payoutId: payout.id,
                        amount: payoutAmount,
                        fieldName: field.name,
                        customerName: booking.user.name || booking.user.email
                    }
                });
                console.log(`Payout processed successfully for booking ${bookingId}: £${payoutAmount}`);
                return payout;
            }
            catch (stripeError) {
                console.error('Stripe transfer error:', stripeError);
                // Update booking to failed payout
                await prisma.booking.update({
                    where: { id: bookingId },
                    data: { payoutStatus: 'FAILED' }
                });
                // Notify admin about failed payout
                const adminUsers = await prisma.user.findMany({
                    where: { role: 'ADMIN' }
                });
                for (const admin of adminUsers) {
                    await (0, notification_controller_1.createNotification)({
                        userId: admin.id,
                        type: 'PAYOUT_FAILED',
                        title: 'Payout Failed',
                        message: `Failed to process payout for booking ${bookingId}. Error: ${stripeError.message}`,
                        data: {
                            bookingId,
                            fieldOwnerId: fieldOwner.id,
                            error: stripeError.message
                        }
                    });
                }
                throw stripeError;
            }
        }
        catch (error) {
            console.error('Error processing payout:', error);
            throw error;
        }
    }
    /**
     * Process pending payouts for field owners who have completed Stripe onboarding
     */
    async processPendingPayouts(userId) {
        try {
            // Get all bookings pending payout for this user's fields
            const userFields = await prisma.field.findMany({
                where: { ownerId: userId },
                select: { id: true }
            });
            const fieldIds = userFields.map(f => f.id);
            const pendingBookings = await prisma.booking.findMany({
                where: {
                    fieldId: { in: fieldIds },
                    status: 'COMPLETED',
                    paymentStatus: 'PAID',
                    payoutStatus: { in: ['PENDING', 'PENDING_ACCOUNT'] }
                }
            });
            console.log(`Processing ${pendingBookings.length} pending payouts for user ${userId}`);
            const results = [];
            for (const booking of pendingBookings) {
                try {
                    const payout = await this.processBookingPayout(booking.id);
                    results.push({ bookingId: booking.id, success: true, payout });
                }
                catch (error) {
                    console.error(`Failed to process payout for booking ${booking.id}:`, error);
                    results.push({ bookingId: booking.id, success: false, error });
                }
            }
            return results;
        }
        catch (error) {
            console.error('Error processing pending payouts:', error);
            throw error;
        }
    }
    /**
     * Get payout history for a field owner
     */
    async getPayoutHistory(userId, page = 1, limit = 10) {
        try {
            // Get Stripe account for this user
            const stripeAccount = await prisma.stripeAccount.findUnique({
                where: { userId }
            });
            if (!stripeAccount) {
                return {
                    payouts: [],
                    total: 0,
                    page,
                    limit,
                    totalPages: 0
                };
            }
            const skip = (page - 1) * limit;
            const [payouts, total] = await Promise.all([
                prisma.payout.findMany({
                    where: { stripeAccountId: stripeAccount.id },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit
                }),
                prisma.payout.count({
                    where: { stripeAccountId: stripeAccount.id }
                })
            ]);
            // Enhance payouts with booking details
            const enhancedPayouts = await Promise.all(payouts.map(async (payout) => {
                const bookings = await prisma.booking.findMany({
                    where: { id: { in: payout.bookingIds } },
                    include: {
                        field: { select: { name: true } },
                        user: { select: { name: true, email: true } }
                    }
                });
                return {
                    ...payout,
                    bookings: bookings.map(b => ({
                        id: b.id,
                        fieldName: b.field.name,
                        customerName: b.user.name || b.user.email,
                        date: b.date,
                        amount: b.fieldOwnerAmount || (b.totalPrice * 0.8)
                    }))
                };
            }));
            return {
                payouts: enhancedPayouts,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        }
        catch (error) {
            console.error('Error fetching payout history:', error);
            throw error;
        }
    }
}
exports.PayoutService = PayoutService;
exports.payoutService = new PayoutService();
