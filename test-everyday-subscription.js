const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEverydayLogic() {
  console.log('Testing everyday subscription logic...\n');

  // Simulate the controller logic
  const repeatBooking = 'Everyday'; // What frontend sends
  const recurringOptions = ['everyday', 'weekly', 'monthly'];
  const normalizedRepeatBooking = repeatBooking?.toLowerCase();

  console.log('Input repeatBooking:', repeatBooking);
  console.log('Normalized:', normalizedRepeatBooking);
  console.log('Recurring options:', recurringOptions);
  console.log('Is included?:', recurringOptions.includes(normalizedRepeatBooking));

  if (repeatBooking && recurringOptions.includes(normalizedRepeatBooking)) {
    console.log('\n✅ Subscription WOULD be created');

    const bookingDate = new Date('2025-10-30T00:00:00.000Z');
    const nextBillingDate = new Date(bookingDate);
    nextBillingDate.setDate(bookingDate.getDate() + 1);

    console.log('Booking date:', bookingDate.toISOString());
    console.log('Next billing date:', nextBillingDate.toISOString());
    console.log('Interval saved to DB:', normalizedRepeatBooking);
  } else {
    console.log('\n❌ Subscription would NOT be created');
  }

  await prisma.$disconnect();
}

testEverydayLogic();
