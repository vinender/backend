const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function markBookingsAsCompleted() {
  try {
    console.log('Marking past bookings as completed...');
    
    const now = new Date();
    
    // Find all bookings that are past their date/time and not already completed or cancelled
    const completedBookings = await prisma.booking.updateMany({
      where: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        date: {
          lt: now,
        },
      },
      data: {
        status: 'COMPLETED',
      },
    });
    
    console.log(`Marked ${completedBookings.count} bookings as completed`);
    
    // Get the bookings that were just marked as completed
    if (completedBookings.count > 0) {
      const newlyCompletedBookings = await prisma.booking.findMany({
        where: {
          status: 'COMPLETED',
          payoutStatus: null,
          paymentStatus: 'PAID',
          updatedAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Updated in last 5 minutes
          }
        },
        include: {
          field: {
            include: {
              owner: true
            }
          }
        }
      });
      
      console.log(`Found ${newlyCompletedBookings.length} bookings needing payouts`);
      
      // Create sample payout records for testing
      for (const booking of newlyCompletedBookings) {
        try {
          const fieldOwner = booking.field.owner;
          
          // Check if field owner has a Stripe account
          const stripeAccount = await prisma.stripeAccount.findUnique({
            where: { userId: fieldOwner.id }
          });
          
          if (!stripeAccount) {
            console.log(`Field owner ${fieldOwner.id} doesn't have a Stripe account, creating test account...`);
            
            // Create a test Stripe account
            const testAccount = await prisma.stripeAccount.create({
              data: {
                userId: fieldOwner.id,
                stripeAccountId: `acct_test_${fieldOwner.id}`,
                chargesEnabled: true,
                payoutsEnabled: true,
                detailsSubmitted: true,
                defaultCurrency: 'usd',
                country: 'US'
              }
            });
            
            // Create test payout record
            const payoutAmount = booking.fieldOwnerAmount || (booking.totalPrice * 0.8);
            
            const payout = await prisma.payout.create({
              data: {
                stripeAccountId: testAccount.id,
                stripePayoutId: `po_test_${booking.id}`,
                amount: payoutAmount,
                currency: 'usd',
                status: 'paid',
                method: 'standard',
                description: `Payout for booking ${booking.id}`,
                bookingIds: [booking.id],
                arrivalDate: new Date()
              }
            });
            
            // Update booking with payout details
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                payoutStatus: 'COMPLETED',
                payoutId: payout.id
              }
            });
            
            console.log(`Created test payout ${payout.id} for booking ${booking.id}: $${payoutAmount}`);
          } else {
            // Create payout for existing Stripe account
            const payoutAmount = booking.fieldOwnerAmount || (booking.totalPrice * 0.8);
            
            const payout = await prisma.payout.create({
              data: {
                stripeAccountId: stripeAccount.id,
                stripePayoutId: `po_test_${booking.id}`,
                amount: payoutAmount,
                currency: 'usd',
                status: 'paid',
                method: 'standard',
                description: `Payout for booking ${booking.id}`,
                bookingIds: [booking.id],
                arrivalDate: new Date()
              }
            });
            
            // Update booking with payout details
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                payoutStatus: 'COMPLETED',
                payoutId: payout.id
              }
            });
            
            console.log(`Created payout ${payout.id} for booking ${booking.id}: $${payoutAmount}`);
          }
        } catch (error) {
          console.error(`Failed to create payout for booking ${booking.id}:`, error);
        }
      }
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

markBookingsAsCompleted();