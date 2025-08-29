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
    
    console.log('=== Booking Details ===');
    console.log('Booking ID:', booking.id);
    console.log('Created at:', booking.createdAt);
    console.log('Booking date:', booking.date);
    console.log('Start time:', booking.startTime);
    console.log('End time:', booking.endTime);
    console.log('Status:', booking.status);
    
    // Calculate refund eligibility
    const bookingCreatedAt = new Date(booking.createdAt);
    const bookingDate = new Date(booking.date);
    
    // Parse the booking start time to add to the date
    const [startHourStr, startPeriod] = booking.startTime.split(/(?=[AP]M)/);
    let startHour = parseInt(startHourStr.split(':')[0]);
    const startMinute = parseInt(startHourStr.split(':')[1] || '0');
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    
    bookingDate.setHours(startHour, startMinute, 0, 0);
    
    console.log('\n=== Refund Eligibility Calculation ===');
    console.log('Booking created at:', bookingCreatedAt.toISOString());
    console.log('Booking scheduled for:', bookingDate.toISOString());
    
    // Calculate hours between creation and booking date/time
    const hoursGap = (bookingDate.getTime() - bookingCreatedAt.getTime()) / (1000 * 60 * 60);
    const isRefundEligible = hoursGap >= 24;
    
    console.log('Hours between creation and scheduled time:', hoursGap.toFixed(2));
    console.log('Minimum hours required for refund:', 24);
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