const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestPayouts() {
  try {
    console.log('Creating test payouts for completed bookings...');
    
    // Get completed bookings without payouts
    const bookings = await prisma.booking.findMany({
      where: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        OR: [
          { payoutStatus: null },
          { payoutStatus: 'PENDING' }
        ]
      },
      include: {
        field: {
          include: {
            owner: true
          }
        },
        user: true
      },
      take: 10 // Process up to 10 bookings
    });
    
    console.log(`Found ${bookings.length} bookings needing payouts`);
    
    for (const booking of bookings) {
      try {
        const fieldOwner = booking.field.owner;
        
        // Check if field owner has a Stripe account
        let stripeAccount = await prisma.stripeAccount.findUnique({
          where: { userId: fieldOwner.id }
        });
        
        if (!stripeAccount) {
          console.log(`Creating test Stripe account for field owner ${fieldOwner.name || fieldOwner.id}...`);
          
          // Create a test Stripe account
          stripeAccount = await prisma.stripeAccount.create({
            data: {
              userId: fieldOwner.id,
              stripeAccountId: `acct_test_${Date.now()}`,
              chargesEnabled: true,
              payoutsEnabled: true,
              detailsSubmitted: true,
              defaultCurrency: 'usd',
              country: 'US'
            }
          });
        }
        
        // Calculate payout amount (80% for field owner, 20% platform fee)
        const payoutAmount = booking.fieldOwnerAmount || (booking.totalPrice * 0.8);
        
        // Create test payout record
        const payout = await prisma.payout.create({
          data: {
            stripeAccountId: stripeAccount.id,
            stripePayoutId: `po_test_${Date.now()}_${booking.id.slice(-6)}`,
            amount: payoutAmount,
            currency: 'usd',
            status: 'paid',
            method: 'standard',
            description: `Payout for booking on ${new Date(booking.date).toLocaleDateString()} at ${booking.field.name}`,
            bookingIds: [booking.id],
            arrivalDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
          }
        });
        
        // Update booking with payout details
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            payoutStatus: 'COMPLETED',
            payoutId: payout.id,
            fieldOwnerAmount: payoutAmount,
            platformFeeAmount: booking.totalPrice * 0.2
          }
        });
        
        console.log(`✅ Created payout ${payout.id} for booking ${booking.id}`);
        console.log(`   Field: ${booking.field.name}`);
        console.log(`   Customer: ${booking.user.name || booking.user.email}`);
        console.log(`   Date: ${new Date(booking.date).toLocaleDateString()}`);
        console.log(`   Amount: $${payoutAmount.toFixed(2)}`);
        console.log('');
      } catch (error) {
        console.error(`❌ Failed to create payout for booking ${booking.id}:`, error.message);
      }
    }
    
    // Get summary of all payouts
    const allPayouts = await prisma.payout.findMany({
      include: {
        stripeAccount: {
          include: {
            user: true
          }
        }
      }
    });
    
    console.log('='.repeat(50));
    console.log('PAYOUT SUMMARY:');
    console.log(`Total payouts created: ${allPayouts.length}`);
    
    const payoutsByOwner = {};
    allPayouts.forEach(payout => {
      const ownerId = payout.stripeAccount.userId;
      const ownerName = payout.stripeAccount.user.name || payout.stripeAccount.user.email;
      if (!payoutsByOwner[ownerId]) {
        payoutsByOwner[ownerId] = {
          name: ownerName,
          count: 0,
          total: 0
        };
      }
      payoutsByOwner[ownerId].count++;
      payoutsByOwner[ownerId].total += payout.amount;
    });
    
    Object.values(payoutsByOwner).forEach(owner => {
      console.log(`${owner.name}: ${owner.count} payouts, Total: $${owner.total.toFixed(2)}`);
    });
    
    console.log('='.repeat(50));
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestPayouts();