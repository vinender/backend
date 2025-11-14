const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBooking() {
  try {
    console.log('🔍 Searching for booking #704ACF62...\n');

    // Search by ID pattern - MongoDB ObjectIds are 24 chars, but the user provided a shorter ID
    // This might be a display ID or order ID - let's search bookings around Nov 14, 2025

    // First, try to find all bookings on Nov 14, 2025 at 11:00 AM - 11:30 AM
    const bookings = await prisma.booking.findMany({
      where: {
        date: {
          gte: new Date('2025-11-14T00:00:00Z'),
          lte: new Date('2025-11-14T23:59:59Z')
        },
        startTime: '11:00AM',
        endTime: '11:30AM'
      },
      include: {
        field: true,
        user: true
      }
    });

    if (bookings.length === 0) {
      console.log('❌ No bookings found for Nov 14, 2025, 11:00AM - 11:30AM\n');

      // Try searching for bookings with similar times
      console.log('🔍 Searching for bookings with similar times...\n');
      const similarBookings = await prisma.booking.findMany({
        where: {
          date: {
            gte: new Date('2025-11-14T00:00:00Z'),
            lte: new Date('2025-11-14T23:59:59Z')
          }
        },
        include: {
          field: true,
          user: true
        }
      });

      console.log(`Found ${similarBookings.length} bookings on Nov 14, 2025:`);
      similarBookings.forEach(b => {
        console.log(`\nBooking ID: ${b.id}`);
        console.log(`Field: ${b.field?.name || 'N/A'}`);
        console.log(`Time: ${b.startTime} - ${b.endTime}`);
        console.log(`Status: ${b.status}`);
        console.log(`Payment Status: ${b.paymentStatus}`);
        console.log(`Created: ${b.createdAt}`);
      });

      return;
    }

    console.log(`✅ Found ${bookings.length} matching booking(s):\n`);

    bookings.forEach((booking, index) => {
      console.log(`\n========== Booking ${index + 1} ==========`);
      console.log(`Booking ID: ${booking.id}`);
      console.log(`Field: ${booking.field?.name || 'N/A'}`);
      console.log(`Location: ${booking.fieldAddress || 'N/A'}`);
      console.log(`Date: ${booking.date}`);
      console.log(`Time: ${booking.startTime} - ${booking.endTime}`);
      console.log(`User: ${booking.user?.name || 'N/A'} (${booking.user?.email || 'N/A'})`);
      console.log(`\nStatus Information:`);
      console.log(`  - Status: ${booking.status}`);
      console.log(`  - Payment Status: ${booking.paymentStatus || 'N/A'}`);
      console.log(`  - Payout Status: ${booking.payoutStatus || 'N/A'}`);
      console.log(`\nTimestamps:`);
      console.log(`  - Created At: ${booking.createdAt}`);
      console.log(`  - Updated At: ${booking.updatedAt}`);
      console.log(`  - Cancelled At: ${booking.cancelledAt || 'N/A'}`);

      // Check if this booking should be COMPLETED
      const now = new Date();
      const endTimeParts = booking.endTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);

      if (endTimeParts) {
        let hours = parseInt(endTimeParts[1]);
        const minutes = parseInt(endTimeParts[2]);
        const period = endTimeParts[3]?.toUpperCase();

        if (period === 'PM' && hours !== 12) hours += 12;
        else if (period === 'AM' && hours === 12) hours = 0;

        const bookingEndDateTime = new Date(booking.date);
        bookingEndDateTime.setHours(hours, minutes, 0, 0);

        console.log(`\nTime Analysis:`);
        console.log(`  - Booking End DateTime: ${bookingEndDateTime.toISOString()}`);
        console.log(`  - Current DateTime: ${now.toISOString()}`);
        console.log(`  - Has Ended: ${bookingEndDateTime < now ? 'YES ✅' : 'NO ❌'}`);
        console.log(`  - Should be COMPLETED: ${
          booking.status === 'CONFIRMED' &&
          booking.paymentStatus === 'PAID' &&
          bookingEndDateTime < now ? 'YES ✅' : 'NO ❌'
        }`);
      }

      console.log(`\n==========================================`);
    });

  } catch (error) {
    console.error('Error checking booking:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBooking();
