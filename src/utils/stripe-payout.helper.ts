//@ts-nocheck
import { stripe } from '../config/stripe.config';

type CreatePayoutParams = {
  stripeAccountId: string;
  amountInMinorUnits: number;
  currency?: string;
  metadata?: Record<string, string>;
  description?: string;
  method?: 'standard' | 'instant';
};

/**
 * Helper to create a payout on a connected Stripe account.
 * Returns the Stripe payout object so callers can persist status/arrival details.
 */
export async function createConnectedAccountPayout({
  stripeAccountId,
  amountInMinorUnits,
  currency = 'gbp',
  metadata = {},
  description,
  method = 'standard',
}: CreatePayoutParams) {
  const payout = await stripe.payouts.create(
    {
      amount: amountInMinorUnits,
      currency,
      metadata,
      description,
      method,
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  return payout;
}
