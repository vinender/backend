import prisma from '../src/config/database';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

if (!STRIPE_SECRET_KEY) {
    console.error('Missing Stripe env vars');
    process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-07-30.basil' as any,
});

async function diagnoseStripeAccounts() {
    console.log('🔍 Diagnosing Stripe Accounts...');

    // 1. Get all local Stripe Accounts
    const localAccounts = await prisma.stripeAccount.findMany({
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true
                }
            }
        }
    });

    console.log(`\nFound ${localAccounts.length} Stripe Accounts in DB:`);
    console.table(localAccounts.map(acc => ({
        id: acc.id,
        userId: acc.userId,
        userEmail: acc.user.email,
        stripeAccountId: acc.stripeAccountId,
        payoutsEnabled: acc.payoutsEnabled
    })));

    // 2. Check validity with Stripe
    console.log('\nChecking validity with Stripe API...');

    console.log(`\n🔑 Stripe Key Mode: ${STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE'}`);

    for (const localAcc of localAccounts) {
        try {
            const stripeAcc = await stripe.accounts.retrieve(localAcc.stripeAccountId);
            console.log(`\n✅ Account ${localAcc.stripeAccountId} (${localAcc.user.email}) exists in Stripe.`);
            console.log(`   - Charges Enabled: ${stripeAcc.charges_enabled}`);
            console.log(`   - Payouts Enabled: ${stripeAcc.payouts_enabled}`);
            console.log(`   - Mode: ${stripeAcc.type}`); // express, standard, etc.

            // Check Balance
            const balance = await stripe.balance.retrieve({ stripeAccount: localAcc.stripeAccountId });
            const available = balance.available.find(b => b.currency === 'gbp')?.amount || 0;
            const pending = balance.pending.find(b => b.currency === 'gbp')?.amount || 0;
            console.log(`   - Balance: Available £${available / 100}, Pending £${pending / 100}`);

            // Check for mismatch
            if (stripeAcc.payouts_enabled !== localAcc.payoutsEnabled) {
                console.warn(`   ⚠️ MISMATCH: DB says payoutsEnabled=${localAcc.payoutsEnabled}, Stripe says ${stripeAcc.payouts_enabled}`);
            }
        } catch (error: any) {
            console.error(`❌ Account ${localAcc.stripeAccountId} NOT FOUND in Stripe or Error:`, error.message);
        }
    }

    // 3. List recent payouts from Stripe for these accounts
    console.log('\nChecking recent payouts from Stripe (limit 20)...');
    for (const localAcc of localAccounts) {
        try {
            const payouts = await stripe.payouts.list({
                limit: 20
            }, {
                stripeAccount: localAcc.stripeAccountId
            });

            if (payouts.data.length > 0) {
                console.log(`Found ${payouts.data.length} recent payouts for ${localAcc.stripeAccountId}:`);
                for (const po of payouts.data) {
                    // Check if this payout exists in DB
                    const dbPayout = await prisma.payout.findUnique({
                        where: { stripePayoutId: po.id }
                    });

                    const statusIcon = dbPayout ? '✅' : '❌';
                    console.log(`   ${statusIcon} ${po.id} (${po.amount / 100} ${po.currency}) - Status: ${po.status} - Created: ${new Date(po.created * 1000).toISOString()} - DB: ${dbPayout ? 'Found' : 'MISSING'}`);
                }
            } else {
                console.log(`No recent payouts for ${localAcc.stripeAccountId}`);
            }
        } catch (error: any) {
            console.error(`Error fetching payouts for ${localAcc.stripeAccountId}:`, error.message);
        }
    }
}

diagnoseStripeAccounts()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
