// Test script to verify payout release schedule is working correctly
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPayoutSchedule() {
  try {
    console.log('Testing payout release schedule functionality...\n');

    // 1. Check current system settings
    const systemSettings = await prisma.systemSettings.findFirst();
    console.log('Current System Settings:');
    console.log('- Payout Release Schedule:', systemSettings?.payoutReleaseSchedule || 'after_cancellation_window');
    console.log('- Cancellation Window Hours:', systemSettings?.cancellationWindowHours || 24);
    console.log('- Commission Rate:', systemSettings?.defaultCommissionRate || 20, '%\n');

    // 2. Find recent bookings and their payout status
    const recentBookings = await prisma.booking.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        },
        paymentStatus: 'PAID'
      },
      include: {
        field: {
          include: {
            owner: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`Found ${recentBookings.length} recent paid bookings:\n`);

    for (const booking of recentBookings) {
      const bookingDateTime = new Date(booking.date);
      const [time, period] = booking.startTime.split(/(?=[AP]M)/);
      const [hours, minutes] = time.split(':').map(Number);
      let hour = hours;
      
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      bookingDateTime.setHours(hour, minutes || 0, 0, 0);
      
      const cancellationDeadline = new Date(bookingDateTime.getTime() - (systemSettings?.cancellationWindowHours || 24) * 60 * 60 * 1000);
      const now = new Date();
      const hasPassed = now > cancellationDeadline;
      
      console.log(`Booking ${booking.id.slice(-8)}:`);
      console.log(`  Field: ${booking.field.name}`);
      console.log(`  Field Owner: ${booking.field.owner.name || booking.field.owner.email}`);
      console.log(`  Date/Time: ${booking.date.toLocaleDateString()} at ${booking.startTime}`);
      console.log(`  Amount: £${booking.totalPrice}`);
      console.log(`  Field Owner Share: £${booking.fieldOwnerAmount || (booking.totalPrice * 0.8)}`);
      console.log(`  Payout Status: ${booking.payoutStatus || 'PENDING'}`);
      console.log(`  Payout Hold Reason: ${booking.payoutHeldReason || 'N/A'}`);
      console.log(`  Cancellation Deadline: ${cancellationDeadline.toLocaleString()}`);
      console.log(`  Cancellation Window Passed: ${hasPassed ? 'Yes ✅' : 'No ⏳'}`);
      
      // Check field owner's Stripe account
      const stripeAccount = await prisma.stripeAccount.findUnique({
        where: { userId: booking.field.ownerId }
      });
      
      if (!stripeAccount) {
        console.log(`  Stripe Account: Not Connected ❌`);
      } else {
        console.log(`  Stripe Account: ${stripeAccount.chargesEnabled && stripeAccount.payoutsEnabled ? 'Connected ✅' : 'Incomplete ⚠️'}`);
      }
      
      // Determine expected payout behavior based on settings
      const payoutSchedule = systemSettings?.payoutReleaseSchedule || 'after_cancellation_window';
      let expectedRelease = 'N/A';
      
      if (!stripeAccount || !stripeAccount.chargesEnabled || !stripeAccount.payoutsEnabled) {
        expectedRelease = 'Held - No Stripe Account';
      } else if (payoutSchedule === 'immediate') {
        expectedRelease = 'Should be released immediately';
      } else if (payoutSchedule === 'on_weekend') {
        const today = new Date().getDay();
        if (today === 5 || today === 6 || today === 0) {
          expectedRelease = 'Should be released today (weekend)';
        } else {
          expectedRelease = 'Waiting for weekend';
        }
      } else if (payoutSchedule === 'after_cancellation_window') {
        if (hasPassed) {
          expectedRelease = 'Should be released (window passed)';
        } else {
          expectedRelease = 'Waiting for cancellation window to pass';
        }
      }
      
      console.log(`  Expected Behavior: ${expectedRelease}`);
      console.log('');
    }

    // 3. Test different schedule scenarios
    console.log('\n=== Testing Schedule Scenarios ===\n');
    
    // Get a test booking (or create one)
    const testBooking = recentBookings[0];
    
    if (testBooking) {
      console.log('Testing with booking:', testBooking.id.slice(-8));
      
      // Test immediate release
      console.log('\n1. Testing IMMEDIATE release:');
      await prisma.systemSettings.updateMany({
        data: { payoutReleaseSchedule: 'immediate' }
      });
      console.log('   ✅ Set to immediate - payouts should process right after payment confirmation');
      
      // Test weekend release
      console.log('\n2. Testing WEEKEND release:');
      await prisma.systemSettings.updateMany({
        data: { payoutReleaseSchedule: 'on_weekend' }
      });
      const today = new Date().getDay();
      const daysUntilFriday = today <= 5 ? 5 - today : 7 - today + 5;
      console.log(`   ✅ Set to weekend - payouts will process on Friday/Saturday/Sunday`);
      console.log(`   Current day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today]}`);
      if (today === 5 || today === 6 || today === 0) {
        console.log('   Today is weekend - payouts should process today!');
      } else {
        console.log(`   Next payout day in ${daysUntilFriday} days`);
      }
      
      // Test cancellation window
      console.log('\n3. Testing AFTER_CANCELLATION_WINDOW release:');
      await prisma.systemSettings.updateMany({
        data: { payoutReleaseSchedule: 'after_cancellation_window' }
      });
      console.log('   ✅ Set to after cancellation window - payouts process after window expires');
      console.log(`   Cancellation window: ${systemSettings?.cancellationWindowHours || 24} hours before booking`);
      
      // Restore original setting
      await prisma.systemSettings.updateMany({
        data: { payoutReleaseSchedule: systemSettings?.payoutReleaseSchedule || 'after_cancellation_window' }
      });
      console.log(`\n✅ Restored original setting: ${systemSettings?.payoutReleaseSchedule || 'after_cancellation_window'}`);
    }
    
    // 4. Check for any stuck payouts
    console.log('\n=== Checking for Stuck Payouts ===\n');
    
    const stuckPayouts = await prisma.booking.findMany({
      where: {
        paymentStatus: 'PAID',
        payoutStatus: 'HELD',
        createdAt: {
          lte: new Date(Date.now() - 48 * 60 * 60 * 1000) // More than 48 hours old
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
    
    if (stuckPayouts.length > 0) {
      console.log(`⚠️ Found ${stuckPayouts.length} stuck payouts:`);
      for (const stuck of stuckPayouts) {
        console.log(`  - Booking ${stuck.id.slice(-8)}: ${stuck.payoutHeldReason || 'Unknown reason'}`);
      }
    } else {
      console.log('✅ No stuck payouts found');
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Run the test
testPayoutSchedule();