import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import Stripe from 'stripe';
import { payoutService } from '../services/payout.service';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia'
});

class StripeConnectController {
  // Create Stripe Connect account
  createConnectAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Only field owners can create connect accounts
    if (userRole !== 'FIELD_OWNER') {
      throw new AppError('Only field owners can connect bank accounts', 403);
    }

    // Check if user already has a Stripe account
    const existingAccount = await prisma.stripeAccount.findUnique({
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
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError('User not found', 404);
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
    } catch (stripeError: any) {
      console.error('Stripe Connect Error:', stripeError);
      // If Stripe Connect is not enabled, provide a helpful message
      if (stripeError.message?.includes('Connect')) {
        throw new AppError(
          'Stripe Connect is not configured for this account. Please contact support.',
          400
        );
      }
      throw new AppError(stripeError.message || 'Failed to create Stripe account', 400);
    }

    // Save account to database
    const stripeAccount = await prisma.stripeAccount.create({
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
  getOnboardingLink = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const { returnUrl, refreshUrl } = req.body;

    // Get Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { userId }
    });

    if (!stripeAccount) {
      throw new AppError('No Stripe account found. Please create one first.', 404);
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
  getAccountStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    // Get Stripe account from database
    const stripeAccount = await prisma.stripeAccount.findUnique({
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
    await prisma.stripeAccount.update({
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
    
    // If account just became fully enabled, process pending payouts
    if (wasNotEnabled && isNowEnabled) {
      console.log(`Stripe account for user ${userId} is now fully enabled. Processing pending payouts...`);
      try {
        const results = await payoutService.processPendingPayouts(userId);
        console.log(`Processed pending payouts for user ${userId}:`, results);
      } catch (error) {
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
  getBalance = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    // Get Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
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
    } catch (error) {
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
  createPayout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const { amount, currency = 'gbp', method = 'standard' } = req.body;

    // Get Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { userId }
    });

    if (!stripeAccount) {
      throw new AppError('No Stripe account found', 404);
    }

    if (!stripeAccount.payoutsEnabled) {
      throw new AppError('Payouts are not enabled for your account', 400);
    }

    // Create payout in Stripe
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100), // Convert to smallest currency unit
        currency,
        method: method as Stripe.PayoutCreateParams.Method,
        metadata: {
          userId
        }
      },
      {
        stripeAccount: stripeAccount.stripeAccountId
      }
    );

    // Save payout to database
    const savedPayout = await prisma.payout.create({
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
  updateBankAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    // Get Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { userId }
    });

    if (!stripeAccount) {
      throw new AppError('No Stripe account found', 404);
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
  disconnectAccount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;

    // Get Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { userId }
    });

    if (!stripeAccount) {
      throw new AppError('No Stripe account found', 404);
    }

    // Delete account from Stripe
    try {
      await stripe.accounts.del(stripeAccount.stripeAccountId);
    } catch (error) {
      console.error('Error deleting Stripe account:', error);
    }

    // Delete from database
    await prisma.stripeAccount.delete({
      where: { id: stripeAccount.id }
    });

    res.json({
      success: true,
      message: 'Bank account disconnected successfully'
    });
  });

  // Get payout history
  getPayoutHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.id;
    const { page = 1, limit = 10, status } = req.query;

    // Get Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
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
    const filter: any = {
      stripeAccountId: stripeAccount.id
    };

    if (status) {
      filter.status = status as string;
    }

    // Get payouts
    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: filter,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payout.count({ where: filter })
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

export default new StripeConnectController();