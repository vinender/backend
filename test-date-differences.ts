import prisma from './src/config/database';

async function checkDateDifferences() {
  try {
    // Find the specific booking
    const booking = await prisma.booking.findUnique({
      where: {
        id: '68b172e57c0173a3d83237bf'
      }
    });
    
    if (!booking) {
      console.log('Booking not found');
      return;
    }
    
    console.log('=== BOOKING DATA ANALYSIS ===\n');
    
    // 1. Created At Analysis
    const createdAt = new Date(booking.createdAt);
    console.log('1. CREATED AT (when booking was made):');
    console.log('   Raw value:', booking.createdAt);
    console.log('   ISO String:', createdAt.toISOString());
    console.log('   Local time:', createdAt.toLocaleString('en-US', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }));
    console.log('   Unix timestamp:', createdAt.getTime());
    
    // 2. Booking Date Analysis
    const bookingDate = new Date(booking.date);
    console.log('\n2. BOOKING DATE (date of the field booking):');
    console.log('   Raw value:', booking.date);
    console.log('   ISO String:', bookingDate.toISOString());
    console.log('   Local date:', bookingDate.toLocaleDateString('en-US', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }));
    console.log('   Unix timestamp:', bookingDate.getTime());
    
    // 3. Time Slot Analysis
    console.log('\n3. TIME SLOT:');
    console.log('   Start time:', booking.startTime);
    console.log('   End time:', booking.endTime);
    console.log('   Full slot:', booking.timeSlot);
    
    // 4. Combine Date and Time
    const bookingDateTime = new Date(booking.date);
    const [startHourStr, startPeriod] = booking.startTime.split(/(?=[AP]M)/);
    let startHour = parseInt(startHourStr.split(':')[0]);
    const startMinute = parseInt(startHourStr.split(':')[1] || '0');
    
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    
    bookingDateTime.setHours(startHour, startMinute, 0, 0);
    
    console.log('\n4. COMBINED BOOKING DATE + TIME:');
    console.log('   ISO String:', bookingDateTime.toISOString());
    console.log('   Local time:', bookingDateTime.toLocaleString('en-US', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      weekday: 'long'
    }));
    console.log('   Unix timestamp:', bookingDateTime.getTime());
    
    // 5. Calculate Time Differences
    console.log('\n=== TIME DIFFERENCES ===\n');
    
    // Difference between creation and booking date (without time)
    const dateDiffMs = bookingDate.getTime() - createdAt.getTime();
    const dateDiffHours = dateDiffMs / (1000 * 60 * 60);
    const dateDiffDays = dateDiffHours / 24;
    
    console.log('5. DIFFERENCE (Creation to Booking Date only):');
    console.log('   Milliseconds:', dateDiffMs);
    console.log('   Hours:', dateDiffHours.toFixed(2));
    console.log('   Days:', dateDiffDays.toFixed(2));
    
    // Difference between creation and actual booking time
    const fullDiffMs = bookingDateTime.getTime() - createdAt.getTime();
    const fullDiffHours = fullDiffMs / (1000 * 60 * 60);
    const fullDiffDays = fullDiffHours / 24;
    
    console.log('\n6. DIFFERENCE (Creation to Booking Date+Time):');
    console.log('   Milliseconds:', fullDiffMs);
    console.log('   Hours:', fullDiffHours.toFixed(2));
    console.log('   Days:', fullDiffDays.toFixed(2));
    
    // 7. Refund Eligibility
    console.log('\n=== REFUND ELIGIBILITY ===\n');
    const isEligible = fullDiffHours >= 24;
    
    console.log('Minimum hours required for refund: 24');
    console.log('Actual hours between booking creation and scheduled time:', fullDiffHours.toFixed(2));
    console.log('Is eligible for refund?:', isEligible ? 'YES ✅' : 'NO ❌');
    
    if (isEligible) {
      console.log('\n✅ ELIGIBLE FOR REFUND');
      console.log(`This booking was made ${fullDiffHours.toFixed(0)} hours (${fullDiffDays.toFixed(1)} days) in advance.`);
      console.log('Since it was booked more than 24 hours before the scheduled time,');
      console.log('it qualifies for a full refund upon cancellation.');
    } else {
      console.log('\n❌ NOT ELIGIBLE FOR REFUND');
      console.log(`This booking was made only ${fullDiffHours.toFixed(0)} hours before the scheduled time.`);
      console.log('Bookings must be made at least 24 hours in advance to qualify for refunds.');
    }
    
    // Visual Timeline
    console.log('\n=== VISUAL TIMELINE ===\n');
    console.log('Created:   Aug 29, 2025 @ 9:29 AM');
    console.log('           |');
    console.log(`           | <--- ${fullDiffHours.toFixed(0)} hours gap --->`);
    console.log('           |');
    console.log('Scheduled: Sep 1, 2025 @ 8:00 AM');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDateDifferences();