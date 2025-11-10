// Test script to verify recurring booking creation after fixing isRecurring error
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRecurringBookingCreation() {
  try {
    console.log('🔍 Testing recurring booking creation after isRecurring fix...\n');

    // Get all active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active'
      },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        },
        field: {
          select: {
            name: true
          }
        },
        bookings: {
          where: {
            status: { not: 'CANCELLED' }
          },
          orderBy: {
            date: 'desc'
          },
          take: 5
        }
      }
    });

    console.log(`Found ${subscriptions.length} active subscription(s)\n`);

    for (const subscription of subscriptions) {
      console.log('━'.repeat(60));
      console.log(`Subscription ID: ${subscription.id}`);
      console.log(`User: ${subscription.user.name || subscription.user.email}`);
      console.log(`Field: ${subscription.field.name}`);
      console.log(`Interval: ${subscription.interval}`);
      console.log(`Status: ${subscription.status}`);
      console.log(`Next Billing Date: ${subscription.nextBillingDate}`);
      console.log(`\nRecent Bookings (${subscription.bookings.length}):`);

      const now = new Date();
      const futureBookings = [];
      const pastBookings = [];

      subscription.bookings.forEach((booking, idx) => {
        const bookingDate = new Date(booking.date);
        const isFuture = bookingDate > now;

        if (isFuture) {
          futureBookings.push(booking);
        } else {
          pastBookings.push(booking);
        }

        console.log(`  ${idx + 1}. ${booking.date} ${booking.startTime}-${booking.endTime}`);
        console.log(`     Status: ${booking.status} | ${isFuture ? '🔮 FUTURE' : '📅 PAST'}`);
      });

      console.log(`\n📊 Summary:`);
      console.log(`   - Past bookings: ${pastBookings.length}`);
      console.log(`   - Future bookings: ${futureBookings.length}`);

      // Check if next billing date is in the past
      const nextBillingDate = new Date(subscription.nextBillingDate);
      const isPastDue = nextBillingDate < now;

      if (isPastDue) {
        console.log(`   ⚠️  Next billing date is in the PAST (${subscription.nextBillingDate})`);
        console.log(`   ✅ This subscription needs a new booking created`);
      } else {
        console.log(`   ✅ Next billing date is in the future (${subscription.nextBillingDate})`);
      }

      if (futureBookings.length === 0) {
        console.log(`   ⚠️  No future bookings found - cron job should create one`);
      }

      console.log('');
    }

    console.log('━'.repeat(60));
    console.log('\n✅ Test complete. The cron job will automatically create missing bookings.');
    console.log('💡 The hourly cron job runs every hour to check and create bookings.');
    console.log('💡 You can also wait for the daily job at 2:00 AM.\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRecurringBookingCreation();
