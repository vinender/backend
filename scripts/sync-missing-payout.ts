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

async function syncMissingPayout() {
    console.log('🔍 Searching for Field Owner...');

    // 1. Find ALL fields to identify potential owners
    const fields = await prisma.field.findMany({
        where: {
            OR: [
                { name: { contains: 'Helsinki Field', mode: 'insensitive' } },
                { name: { contains: 'The cactus garden', mode: 'insensitive' } }
            ]
        },
        include: { owner: true }
    });

    if (fields.length === 0) {
        console.error('❌ Could not find any matching fields in DB.');
        return;
    }

    console.log(`✅ Found ${fields.length} matching fields.`);

    // Get unique owners
    const owners = new Map();
    fields.forEach(f => owners.set(f.owner.id, f.owner));

    for (const user of owners.values()) {
        console.log(`\nChecking Owner: ${user.name} (${user.email}) - ID: ${user.id}`);

        // 2. Get Stripe Account
        let stripeAccount = await prisma.stripeAccount.findUnique({
            where: { userId: user.id }
        });

        if (!stripeAccount) {
            console.warn(`⚠️ No local StripeAccount record for user ${user.id}.`);
            // Try to find by email in Stripe
            const accounts = await stripe.accounts.list({ limit: 100 });
            const match = accounts.data.find(a => a.email === user.email || a.metadata?.userId === user.id);

            if (match) {
                console.log(`✅ Found matching Stripe Account in Stripe: ${match.id}`);
                stripeAccount = { stripeAccountId: match.id } as any; // Mock for next step
            } else {
                console.error('❌ Could not find matching Stripe Account for this user.');
                continue;
            }
        } else {
            console.log(`✅ Found local StripeAccount: ${stripeAccount.stripeAccountId}`);
        }

        // Check external accounts (bank accounts)
        try {
            const externalAccounts = await stripe.accounts.listExternalAccounts(
                stripeAccount.stripeAccountId,
                { object: 'bank_account', limit: 5 }
            );
            externalAccounts.data.forEach(ba => {
                console.log(`   🏦 Bank Account: **** ${ba.last4} (${ba.bank_name || 'Unknown Bank'})`);
            });
        } catch (e: any) {
            console.error('   Error fetching bank accounts:', e.message);
        }

        // 3. Fetch Payouts from Stripe
        console.log(`   Fetching payouts for account ${stripeAccount.stripeAccountId}...`);
        const payouts = await stripe.payouts.list({
            limit: 50 // Increased limit
        }, {
            stripeAccount: stripeAccount.stripeAccountId
        });

        // 4. Find the matching payout (£76.47)
        const targetAmount = 7647;
        const matchingPayout = payouts.data.find(p => p.amount === targetAmount);

        if (matchingPayout) {
            console.log(`   🎯 FOUND MATCHING PAYOUT: ${matchingPayout.id}`);
            console.log(`      Amount: ${matchingPayout.amount / 100} ${matchingPayout.currency}`);
            console.log(`      Status: ${matchingPayout.status}`);

            // 5. Sync to DB
            const existingPayout = await prisma.payout.findUnique({
                where: { stripePayoutId: matchingPayout.id }
            });

            if (existingPayout) {
                console.log('      ℹ️ Payout already exists in DB.');
            } else {
                console.log('      📥 Syncing payout to DB...');

                // Need to ensure we have a real StripeAccount record first
                let dbStripeAccount = await prisma.stripeAccount.findUnique({ where: { userId: user.id } });
                if (!dbStripeAccount) {
                    // Fetch full details to create it
                    const fullAcc = await stripe.accounts.retrieve(stripeAccount.stripeAccountId);
                    dbStripeAccount = await prisma.stripeAccount.create({
                        data: {
                            userId: user.id,
                            stripeAccountId: fullAcc.id,
                            accountType: fullAcc.type,
                            chargesEnabled: fullAcc.charges_enabled,
                            payoutsEnabled: fullAcc.payouts_enabled,
                            detailsSubmitted: fullAcc.details_submitted,
                            email: fullAcc.email
                        }
                    });
                }

                let bookingIds: string[] = [];
                if (matchingPayout.metadata?.bookingIds) {
                    try {
                        bookingIds = JSON.parse(matchingPayout.metadata.bookingIds as string);
                    } catch (e) { }
                }

                await prisma.payout.create({
                    data: {
                        stripeAccountId: dbStripeAccount.id,
                        stripePayoutId: matchingPayout.id,
                        amount: matchingPayout.amount,
                        currency: matchingPayout.currency,
                        status: matchingPayout.status,
                        method: matchingPayout.method,
                        arrivalDate: new Date(matchingPayout.arrival_date * 1000),
                        bookingIds: bookingIds,
                        description: matchingPayout.description
                    }
                });
                console.log('      ✅ Payout successfully synced to DB!');
            }
        } else {
            console.log(`      ❌ No payout for £${targetAmount / 100} found.`);
            console.log('      Recent payouts:');
            payouts.data.slice(0, 5).forEach(p => console.log(`      - ${p.id}: ${p.amount / 100} ${p.currency} (${p.status}) - ${new Date(p.created * 1000).toISOString()}`));
        }
    }
}

syncMissingPayout()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
