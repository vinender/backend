// Manually trigger the recurring booking cron job to test the fix
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the subscription service
const path = require('path');
const subscriptionServicePath = path.join(__dirname, 'src/services/subscription.service.ts');

// We'll use a simplified version of the cron job logic
async function createPastDueBookings() {
  try {
    console.log('🔄 Checking for subscriptions that need new bookings...\n');

    const now = new Date();

    // Get all active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active'
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            price: true,
            ownerId: true
          }
        },
        user: {
          select: {
            email: true,
            name: true
          }
        },
        bookings: {
          where: {
            status: { not: 'CANCELLED' }
          },
          orderBy: {
            date: 'desc'
          }
        }
      }
    });

    console.log(`Found ${subscriptions.length} active subscriptions\n`);

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const subscription of subscriptions) {
      // Get the most recent booking
      const mostRecentBooking = subscription.bookings[0];

      if (!mostRecentBooking) {
        console.log(`⚠️  Subscription ${subscription.id} has no bookings - skipping`);
        skippedCount++;
        continue;
      }

      const bookingDateTime = new Date(mostRecentBooking.date);

      // Check if the most recent booking is in the past
      if (bookingDateTime < now) {
        console.log(`\n🔨 Creating new booking for subscription ${subscription.id}`);
        console.log(`   Field: ${subscription.field.name}`);
        console.log(`   User: ${subscription.user.name || subscription.user.email}`);
        console.log(`   Interval: ${subscription.interval}`);
        console.log(`   Last booking: ${mostRecentBooking.date}`);

        try {
          // Calculate next booking date based on interval
          let nextDate = new Date(mostRecentBooking.date);

          switch (subscription.interval.toLowerCase()) {
            case 'everyday':
              nextDate.setDate(nextDate.getDate() + 1);
              break;
            case 'weekly':
              nextDate.setDate(nextDate.getDate() + 7);
              break;
            case 'monthly':
              nextDate.setMonth(nextDate.getMonth() + 1);
              break;
            default:
              console.log(`   ❌ Unknown interval: ${subscription.interval}`);
              errorCount++;
              continue;
          }

          console.log(`   Next booking date: ${nextDate}`);

          // Create the new booking
          const totalPrice = subscription.field.price;
          const platformCommission = totalPrice * 0.20;
          const fieldOwnerAmount = totalPrice * 0.80;

          const newBooking = await prisma.booking.create({
            data: {
              date: nextDate,
              startTime: mostRecentBooking.startTime,
              endTime: mostRecentBooking.endTime,
              numberOfDogs: mostRecentBooking.numberOfDogs,
              totalPrice: totalPrice,
              status: 'CONFIRMED',
              field: {
                connect: { id: subscription.field.id }
              },
              user: {
                connect: { id: subscription.userId }
              },
              subscription: {
                connect: { id: subscription.id }
              },
              platformCommission: platformCommission,
              fieldOwnerAmount: fieldOwnerAmount
            }
          });

          // Update subscription's next billing date
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              nextBillingDate: nextDate
            }
          });

          console.log(`   ✅ Created booking ${newBooking.id}`);
          createdCount++;

        } catch (error) {
          console.log(`   ❌ Failed to create booking: ${error.message}`);
          errorCount++;
        }
      } else {
        console.log(`✓ Subscription ${subscription.id} (${subscription.field.name}) - most recent booking is in the future, skipping`);
        skippedCount++;
      }
    }

    console.log('\n━'.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${createdCount} booking(s)`);
    console.log(`   ⏭️  Skipped: ${skippedCount} subscription(s)`);
    console.log(`   ❌ Errors: ${errorCount} error(s)`);
    console.log('\n✅ Recurring booking cron job completed!\n');

  } catch (error) {
    console.error('❌ Cron job failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createPastDueBookings();
