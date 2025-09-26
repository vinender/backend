"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
const asyncHandler_1 = require("../utils/asyncHandler");
const AppError_1 = require("../utils/AppError");
const stripe_1 = __importDefault(require("stripe"));
const payout_service_1 = require("../services/payout.service");
const held_payout_service_1 = require("../services/held-payout.service");
// Initialize Stripe
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia'
});
class StripeConnectController {
    // Create Stripe Connect account
    createConnectAccount = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const userRole = req.user.role;
        // Only field owners can create connect accounts
        if (userRole !== 'FIELD_OWNER') {
            throw new AppError_1.AppError('Only field owners can connect bank accounts', 403);
        }
        // Check if user already has a Stripe account
        const existingAccount = await database_1.default.stripeAccount.findUnique({
            where: { userId }
        });
        if (existingAccount) {
            // Return existing account
            return res.json({
                success: true,
                data: {
                    hasAccount: true,
                    accountId: existingAccount.id,
                    chargesEnabled: existingAccount.chargesEnabled,
                    payoutsEnabled: existingAccount.payoutsEnabled,
                    detailsSubmitted: existingAccount.detailsSubmitted,
                    requirementsCurrentlyDue: existingAccount.requirementsCurrentlyDue
                }
            });
        }
        // Get user details
        const user = await database_1.default.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            throw new AppError_1.AppError('User not found', 404);
        }
        // Create Stripe Connect account
        let account;
        try {
            account = await stripe.accounts.create({
                type: 'express',
                country: 'GB', // Default to UK
                email: user.email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true }
                },
                business_type: 'individual',
                metadata: {
                    userId: userId
                }
            });
        }
        catch (stripeError) {
            console.error('Stripe Connect Error:', stripeError);
            // If Stripe Connect is not enabled, provide a helpful message
            if (stripeError.message?.includes('Connect')) {
                throw new AppError_1.AppError('Stripe Connect is not configured for this account. Please contact support.', 400);
            }
            throw new AppError_1.AppError(stripeError.message || 'Failed to create Stripe account', 400);
        }
        // Save account to database
        const stripeAccount = await database_1.default.stripeAccount.create({
            data: {
                userId,
                stripeAccountId: account.id,
                accountType: 'express',
                chargesEnabled: false,
                payoutsEnabled: false,
                detailsSubmitted: false,
                defaultCurrency: account.default_currency || 'gbp',
                country: account.country || 'GB',
                email: user.email
            }
        });
        res.json({
            success: true,
            message: 'Stripe Connect account created successfully',
            data: {
                accountId: stripeAccount.id,
                stripeAccountId: account.id
            }
        });
    });
    // Generate Stripe Connect onboarding link
    getOnboardingLink = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const { returnUrl, refreshUrl } = req.body;
        // Get Stripe account
        const stripeAccount = await database_1.default.stripeAccount.findUnique({
            where: { userId }
        });
        if (!stripeAccount) {
            throw new AppError_1.AppError('No Stripe account found. Please create one first.', 404);
        }
        // Create account link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccount.stripeAccountId,
            refresh_url: refreshUrl || `${process.env.FRONTEND_URL}/field-owner/payouts?refresh=true`,
            return_url: returnUrl || `${process.env.FRONTEND_URL}/field-owner/payouts?success=true`,
            type: 'account_onboarding'
        });
        res.json({
            success: true,
            data: {
                url: accountLink.url
            }
        });
    });
    // Get Stripe account status
    getAccountStatus = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        // Get Stripe account from database
        const stripeAccount = await database_1.default.stripeAccount.findUnique({
            where: { userId }
        });
        if (!stripeAccount) {
            return res.json({
                success: true,
                data: {
                    hasAccount: false
                }
            });
        }
        // Get updated account info from Stripe
        const account = await stripe.accounts.retrieve(stripeAccount.stripeAccountId);
        // Check if account just became fully enabled
        const wasNotEnabled = !stripeAccount.chargesEnabled || !stripeAccount.payoutsEnabled;
        const isNowEnabled = account.charges_enabled && account.payouts_enabled;
        // Update database with latest info
        await database_1.default.stripeAccount.update({
            where: { id: stripeAccount.id },
            data: {
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                requirementsCurrentlyDue: account.requirements?.currently_due || [],
                requirementsPastDue: account.requirements?.past_due || [],
                requirementsEventuallyDue: account.requirements?.eventually_due || []
            }
        });
        // If account just became fully enabled, release held payouts and process pending ones
        if (wasNotEnabled && isNowEnabled) {
            console.log(`Stripe account for user ${userId} is now fully enabled. Releasing held payouts...`);
            // First, release any held payouts
            try {
                await held_payout_service_1.heldPayoutService.releaseHeldPayouts(userId);
                console.log(`Released held payouts for user ${userId}`);
            }
            catch (error) {
                console.error(`Failed to release held payouts for user ${userId}:`, error);
                // Don't throw - continue with processing
            }
            // Then process pending payouts
            try {
                const results = await payout_service_1.payoutService.processPendingPayouts(userId);
                console.log(`Processed pending payouts for user ${userId}:`, results);
            }
            catch (error) {
                console.error(`Failed to process pending payouts for user ${userId}:`, error);
                // Don't throw - continue with response
            }
        }
        res.json({
            success: true,
            data: {
                hasAccount: true,
                accountId: stripeAccount.id,
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                requirementsCurrentlyDue: account.requirements?.currently_due || [],
                requirementsPastDue: account.requirements?.past_due || [],
                bankAccountLast4: stripeAccount.bankAccountLast4,
                bankAccountBrand: stripeAccount.bankAccountBrand
            }
        });
    });
    // Get Stripe balance
    getBalance = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        // Get Stripe account
        const stripeAccount = await database_1.default.stripeAccount.findUnique({
            where: { userId }
        });
        if (!stripeAccount) {
            return res.json({
                success: true,
                data: {
                    availableBalance: 0,
                    pendingBalance: 0,
                    currency: 'gbp'
                }
            });
        }
        // Get balance from Stripe
        let availableBalance = 0;
        let pendingBalance = 0;
        try {
            const balance = await stripe.balance.retrieve({
                stripeAccount: stripeAccount.stripeAccountId
            });
            // Get GBP balance (or default currency)
            const available = balance.available.find(b => b.currency === 'gbp');
            const pending = balance.pending.find(b => b.currency === 'gbp');
            availableBalance = available ? available.amount / 100 : 0;
            pendingBalance = pending ? pending.amount / 100 : 0;
        }
        catch (error) {
            console.error('Error fetching Stripe balance:', error);
        }
        res.json({
            success: true,
            data: {
                availableBalance,
                pendingBalance,
                currency: 'gbp'
            }
        });
    });
    // Create manual payout (if instant payouts are enabled)
    createPayout = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const { amount, currency = 'gbp', method = 'standard' } = req.body;
        // Get Stripe account
        const stripeAccount = await database_1.default.stripeAccount.findUnique({
            where: { userId }
        });
        if (!stripeAccount) {
            throw new AppError_1.AppError('No Stripe account found', 404);
        }
        if (!stripeAccount.payoutsEnabled) {
            throw new AppError_1.AppError('Payouts are not enabled for your account', 400);
        }
        // Create payout in Stripe
        const payout = await stripe.payouts.create({
            amount: Math.round(amount * 100), // Convert to smallest currency unit
            currency,
            method: method,
            metadata: {
                userId
            }
        }, {
            stripeAccount: stripeAccount.stripeAccountId
        });
        // Save payout to database
        const savedPayout = await database_1.default.payout.create({
            data: {
                stripeAccountId: stripeAccount.id,
                stripePayoutId: payout.id,
                amount: payout.amount,
                currency: payout.currency,
                status: payout.status,
                method: method,
                arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null
            }
        });
        res.json({
            success: true,
            message: 'Payout initiated successfully',
            data: savedPayout
        });
    });
    // Update bank account
    updateBankAccount = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        // Get Stripe account
        const stripeAccount = await database_1.default.stripeAccount.findUnique({
            where: { userId }
        });
        if (!stripeAccount) {
            throw new AppError_1.AppError('No Stripe account found', 404);
        }
        // Generate account link for updating bank details
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccount.stripeAccountId,
            refresh_url: `${process.env.FRONTEND_URL}/field-owner/payouts?refresh=true`,
            return_url: `${process.env.FRONTEND_URL}/field-owner/payouts?updated=true`,
            type: 'account_update',
            collection_options: {
                fields: 'currently_due'
            }
        });
        res.json({
            success: true,
            data: {
                url: accountLink.url
            }
        });
    });
    // Disconnect Stripe account
    disconnectAccount = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        // Get Stripe account
        const stripeAccount = await database_1.default.stripeAccount.findUnique({
            where: { userId }
        });
        if (!stripeAccount) {
            throw new AppError_1.AppError('No Stripe account found', 404);
        }
        // Delete account from Stripe
        try {
            await stripe.accounts.del(stripeAccount.stripeAccountId);
        }
        catch (error) {
            console.error('Error deleting Stripe account:', error);
        }
        // Delete from database
        await database_1.default.stripeAccount.delete({
            where: { id: stripeAccount.id }
        });
        res.json({
            success: true,
            message: 'Bank account disconnected successfully'
        });
    });
    // Get payout history
    getPayoutHistory = (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;
        // Get Stripe account
        const stripeAccount = await database_1.default.stripeAccount.findUnique({
            where: { userId }
        });
        if (!stripeAccount) {
            return res.json({
                success: true,
                data: {
                    payouts: [],
                    total: 0,
                    page: Number(page),
                    totalPages: 0
                }
            });
        }
        // Build filter
        const filter = {
            stripeAccountId: stripeAccount.id
        };
        if (status) {
            filter.status = status;
        }
        // Get payouts
        const [payouts, total] = await Promise.all([
            database_1.default.payout.findMany({
                where: filter,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: 'desc' }
            }),
            database_1.default.payout.count({ where: filter })
        ]);
        res.json({
            success: true,
            data: {
                payouts,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    });
}
exports.default = new StripeConnectController();
