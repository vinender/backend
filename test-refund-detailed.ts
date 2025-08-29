import prisma from './src/config/database';

async function checkRefundEligibility() {
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
    
    console.log('=== Raw Booking Data ===');
    console.log('Created at (raw):', booking.createdAt);
    console.log('Booking date (raw):', booking.date);
    console.log('Start time (raw):', booking.startTime);
    
    // Calculate refund eligibility
    const bookingCreatedAt = new Date(booking.createdAt);
    const bookingDate = new Date(booking.date);
    
    console.log('\n=== Date Objects Before Time Setting ===');
    console.log('Created at Date object:', bookingCreatedAt);
    console.log('Booking Date object:', bookingDate);
    console.log('Booking Date ISO:', bookingDate.toISOString());
    console.log('Booking Date Local:', bookingDate.toLocaleString());
    
    // Parse the booking start time to add to the date
    const [startHourStr, startPeriod] = booking.startTime.split(/(?=[AP]M)/);
    let startHour = parseInt(startHourStr.split(':')[0]);
    const startMinute = parseInt(startHourStr.split(':')[1] || '0');
    
    console.log('\n=== Time Parsing ===');
    console.log('Start time string:', booking.startTime);
    console.log('Parsed hour (before conversion):', startHour);
    console.log('Parsed minute:', startMinute);
    console.log('Period:', startPeriod);
    
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    
    console.log('Final hour (24hr format):', startHour);
    
    // Set the time on the booking date
    bookingDate.setHours(startHour, startMinute, 0, 0);
    
    console.log('\n=== After Setting Time ===');
    console.log('Booking date/time:', bookingDate);
    console.log('Booking date/time ISO:', bookingDate.toISOString());
    console.log('Booking date/time Local:', bookingDate.toLocaleString());
    
    // Calculate hours between creation and booking date/time
    const msGap = bookingDate.getTime() - bookingCreatedAt.getTime();
    const hoursGap = msGap / (1000 * 60 * 60);
    const isRefundEligible = hoursGap >= 24;
    
    console.log('\n=== Final Calculation ===');
    console.log('Created timestamp:', bookingCreatedAt.getTime());
    console.log('Booking timestamp:', bookingDate.getTime());
    console.log('Milliseconds gap:', msGap);
    console.log('Hours gap:', hoursGap.toFixed(2));
    console.log('Is eligible for refund?:', isRefundEligible ? 'YES ✅' : 'NO ❌');
    
    if (isRefundEligible) {
      console.log('\n✅ This booking IS ELIGIBLE for a full refund upon cancellation.');
      console.log(`   The booking was made ${Math.floor(hoursGap)} hours in advance.`);
    } else {
      console.log('\n❌ This booking is NOT ELIGIBLE for a refund.');
      console.log(`   The booking was made only ${Math.floor(hoursGap)} hours before the scheduled time.`);
      console.log('   Minimum 24 hours advance booking is required for refund eligibility.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRefundEligibility();