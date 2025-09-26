// Check for bookings with repeatBooking field set
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRecurringBookings() {
  try {
    console.log('Checking for recurring bookings in the database...\n');

    // 1. Check bookings with repeatBooking field
    const recurringBookings = await prisma.booking.findMany({
      where: {
        repeatBooking: {
          not: 'none',
          not: null
        }
      },
      include: {
        field: {
          select: {
            name: true,
            owner: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`Found ${recurringBookings.length} bookings with repeatBooking set:\n`);

    for (const booking of recurringBookings) {
      console.log(`Booking ${booking.id.slice(-8)}:`);
      console.log(`  User: ${booking.user.name || booking.user.email}`);
      console.log(`  Field: ${booking.field.name}`);
      console.log(`  Date: ${booking.date.toLocaleDateString()}`);
      console.log(`  Time: ${booking.startTime} - ${booking.endTime}`);
      console.log(`  Repeat: ${booking.repeatBooking}`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Payment Status: ${booking.paymentStatus}`);
      console.log(`  Total Price: £${booking.totalPrice}`);
      console.log('');
    }

    // 2. Check subscriptions table
    const subscriptions = await prisma.subscription.findMany({
      include: {
        field: {
          select: {
            name: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`\nFound ${subscriptions.length} subscriptions in subscription table:\n`);

    for (const sub of subscriptions) {
      console.log(`Subscription ${sub.id.slice(-8)}:`);
      console.log(`  User: ${sub.user.name || sub.user.email}`);
      console.log(`  Field: ${sub.field.name}`);
      console.log(`  Interval: ${sub.interval}`);
      console.log(`  Status: ${sub.status}`);
      console.log(`  Next Billing: ${sub.nextBillingDate?.toLocaleDateString() || 'N/A'}`);
      console.log('');
    }

    // 3. Test the API endpoint
    console.log('\n=== Testing API Endpoint ===\n');
    
    if (recurringBookings.length > 0) {
      const testUserId = recurringBookings[0].userId;
      
      // Get recurring bookings for this user
      const userRecurringBookings = await prisma.booking.findMany({
        where: {
          userId: testUserId,
          repeatBooking: {
            not: 'none',
            not: null
          }
        }
      });

      const userSubscriptions = await prisma.subscription.findMany({
        where: {
          userId: testUserId
        }
      });

      console.log(`For user ${testUserId.slice(-8)}:`);
      console.log(`  Regular bookings with repeatBooking: ${userRecurringBookings.length}`);
      console.log(`  Subscriptions: ${userSubscriptions.length}`);
      console.log(`  Total recurring items: ${userRecurringBookings.length + userSubscriptions.length}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecurringBookings();