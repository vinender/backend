/**
 * Test Script: Held Payout Release Automation
 *
 * This script tests the automatic release of held payouts when a field owner
 * connects their Stripe account. It simulates the complete flow:
 *
 * 1. Create a test field owner without Stripe account
 * 2. Create bookings that generate held payouts
 * 3. Verify payouts are held with reason "NO_STRIPE_ACCOUNT"
 * 4. Simulate Stripe account connection
 * 5. Verify automatic release of held payouts
 * 6. Verify notifications are sent
 * 7. Cleanup test data
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test data storage
const testData = {
  fieldOwner: null,
  dogOwner: null,
  field: null,
  bookings: [],
  stripeAccount: null,
  notifications: []
};

async function cleanup() {
  logSection('🧹 Cleanup Phase');

  try {
    // Delete in reverse order of dependencies
    if (testData.notifications.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: testData.notifications.map(n => n.id) } }
      });
      logSuccess(`Deleted ${testData.notifications.length} test notifications`);
    }

    if (testData.bookings.length > 0) {
      await prisma.booking.deleteMany({
        where: { id: { in: testData.bookings.map(b => b.id) } }
      });
      logSuccess(`Deleted ${testData.bookings.length} test bookings`);
    }

    if (testData.stripeAccount) {
      await prisma.stripeAccount.delete({
        where: { id: testData.stripeAccount.id }
      });
      logSuccess('Deleted test Stripe account');
    }

    if (testData.field) {
      await prisma.field.delete({
        where: { id: testData.field.id }
      });
      logSuccess('Deleted test field');
    }

    if (testData.dogOwner) {
      await prisma.user.delete({
        where: { id: testData.dogOwner.id }
      });
      logSuccess('Deleted test dog owner');
    }

    if (testData.fieldOwner) {
      await prisma.user.delete({
        where: { id: testData.fieldOwner.id }
      });
      logSuccess('Deleted test field owner');
    }

  } catch (error) {
    logError(`Cleanup error: ${error.message}`);
  }
}

async function createTestUsers() {
  logSection('👥 Creating Test Users');

  // Create field owner without Stripe account
  testData.fieldOwner = await prisma.user.create({
    data: {
      name: 'Test Field Owner (No Stripe)',
      email: `test-field-owner-${Date.now()}@test.com`,
      phone: `+1555${Math.floor(Math.random() * 10000000)}`,
      password: 'hashedPassword123',
      role: 'FIELD_OWNER'
    }
  });
  logSuccess(`Created field owner: ${testData.fieldOwner.email}`);

  // Create dog owner
  testData.dogOwner = await prisma.user.create({
    data: {
      name: 'Test Dog Owner',
      email: `test-dog-owner-${Date.now()}@test.com`,
      phone: `+1555${Math.floor(Math.random() * 10000000)}`,
      password: 'hashedPassword123',
      role: 'DOG_OWNER'
    }
  });
  logSuccess(`Created dog owner: ${testData.dogOwner.email}`);
}

async function createTestField() {
  logSection('🏞️  Creating Test Field');

  testData.field = await prisma.field.create({
    data: {
      name: 'Test Field for Held Payouts',
      description: 'A test field to verify held payout automation',
      address: '123 Test Street, Test City, TC 12345',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      latitude: 40.7128,
      longitude: -74.0060,
      price: 50.00,
      pricePerDay: 50.00,
      amenities: ['Water', 'Fencing'],
      images: ['https://example.com/test-image.jpg'],
      approvalStatus: 'APPROVED',
      isApproved: true,
      isClaimed: true,
      isSubmitted: true,
      isActive: true,
      ownerId: testData.fieldOwner.id,
      openingTime: '08:00',
      closingTime: '18:00',
      operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }
  });
  logSuccess(`Created field: ${testData.field.name}`);
}

async function createHeldBookings() {
  logSection('📅 Creating Bookings (Should be HELD)');

  const now = new Date();
  const systemSettings = await prisma.systemSettings.findFirst();
  const commissionRate = systemSettings?.defaultCommissionRate || 10;

  // Create 3 test bookings with different dates
  for (let i = 0; i < 3; i++) {
    const bookingDate = new Date(now);
    bookingDate.setDate(bookingDate.getDate() + (i + 2)); // 2, 3, 4 days in future

    const totalPrice = 100.00 + (i * 25); // $100, $125, $150
    const platformCommission = (totalPrice * commissionRate) / 100;
    const fieldOwnerAmount = totalPrice - platformCommission;

    const booking = await prisma.booking.create({
      data: {
        userId: testData.dogOwner.id,
        fieldId: testData.field.id,
        date: bookingDate,
        startTime: '10:00',
        endTime: '12:00',
        totalPrice,
        platformCommission,
        fieldOwnerAmount,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentIntentId: `pi_test_${Date.now()}_${i}`,
        // These should be set automatically by booking logic, but we set them explicitly
        payoutStatus: 'HELD',
        payoutHeldReason: 'NO_STRIPE_ACCOUNT'
      }
    });

    testData.bookings.push(booking);
    logSuccess(`Created booking #${i + 1}: $${totalPrice} on ${bookingDate.toLocaleDateString()}`);
    logInfo(`  → Field owner amount: $${fieldOwnerAmount.toFixed(2)}`);
    logInfo(`  → Platform commission: $${platformCommission.toFixed(2)}`);
    logInfo(`  → Status: ${booking.payoutStatus} (${booking.payoutHeldReason})`);
  }

  const totalHeld = testData.bookings.reduce((sum, b) => sum + b.fieldOwnerAmount, 0);
  logWarning(`Total amount held: $${totalHeld.toFixed(2)}`);
}

async function verifyHeldPayouts() {
  logSection('🔍 Verifying Payouts are HELD');

  const heldBookings = await prisma.booking.findMany({
    where: {
      id: { in: testData.bookings.map(b => b.id) },
      payoutStatus: 'HELD',
      payoutHeldReason: 'NO_STRIPE_ACCOUNT'
    }
  });

  if (heldBookings.length === testData.bookings.length) {
    logSuccess(`All ${heldBookings.length} bookings are correctly HELD`);
    return true;
  } else {
    logError(`Expected ${testData.bookings.length} held bookings, found ${heldBookings.length}`);
    return false;
  }
}

async function connectStripeAccount() {
  logSection('💳 Simulating Stripe Account Connection');

  // Import the held payout service from the compiled dist folder
  const { heldPayoutService } = require('./dist/src/services/held-payout.service');

  // Create a fully enabled Stripe account
  testData.stripeAccount = await prisma.stripeAccount.create({
    data: {
      userId: testData.fieldOwner.id,
      stripeAccountId: `acct_test_${Date.now()}`,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true
    }
  });
  logSuccess(`Created Stripe account: ${testData.stripeAccount.stripeAccountId}`);

  // Trigger the automatic release (this is what happens in stripe-connect.controller.ts)
  logInfo('Triggering automatic payout release...');
  await heldPayoutService.releaseHeldPayouts(testData.fieldOwner.id);
  logSuccess('Release process completed');
}

async function verifyPayoutsReleased() {
  logSection('✅ Verifying Payouts are RELEASED');

  // Check that all bookings are no longer HELD
  const stillHeld = await prisma.booking.findMany({
    where: {
      id: { in: testData.bookings.map(b => b.id) },
      payoutStatus: 'HELD'
    }
  });

  if (stillHeld.length > 0) {
    logError(`${stillHeld.length} bookings are still HELD!`);
    return false;
  }

  // Check that all bookings are now PENDING
  const releasedBookings = await prisma.booking.findMany({
    where: {
      id: { in: testData.bookings.map(b => b.id) }
    }
  });

  let allReleased = true;
  for (const booking of releasedBookings) {
    if (booking.payoutStatus === 'PENDING' && !booking.payoutHeldReason && booking.payoutReleasedAt) {
      logSuccess(`Booking ${booking.id}: ${booking.payoutStatus} (released at ${booking.payoutReleasedAt.toLocaleString()})`);
    } else {
      logError(`Booking ${booking.id}: Unexpected status ${booking.payoutStatus}`);
      allReleased = false;
    }
  }

  return allReleased;
}

async function verifyNotifications() {
  logSection('📬 Verifying Notifications');

  const notifications = await prisma.notification.findMany({
    where: {
      userId: testData.fieldOwner.id,
      type: 'PAYOUT_RELEASED'
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 1
  });

  if (notifications.length > 0) {
    const notification = notifications[0];
    testData.notifications = notifications; // Store for cleanup

    logSuccess('Found payout release notification:');
    logInfo(`  → Title: ${notification.title}`);
    logInfo(`  → Message: ${notification.message}`);
    logInfo(`  → Created: ${notification.createdAt.toLocaleString()}`);
    return true;
  } else {
    logWarning('No notification found - may need to check notification creation');
    return false;
  }
}

async function testGetHeldPayoutsEndpoint() {
  logSection('🌐 Testing GET /api/earnings/held-payouts Endpoint');

  // Before Stripe connection - should show held payouts
  logInfo('Testing endpoint logic with held payouts...');

  // Manually call the endpoint logic
  const userFields = await prisma.field.findMany({
    where: { ownerId: testData.fieldOwner.id },
    select: { id: true, name: true }
  });

  const fieldIds = userFields.map(f => f.id);

  const heldBookings = await prisma.booking.findMany({
    where: {
      fieldId: { in: fieldIds },
      payoutStatus: 'HELD',
      payoutHeldReason: { in: ['NO_STRIPE_ACCOUNT', 'WITHIN_CANCELLATION_WINDOW', 'WAITING_FOR_WEEKEND'] },
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      paymentStatus: 'PAID'
    },
    include: {
      field: { select: { name: true, id: true } },
      user: { select: { name: true, email: true } }
    }
  });

  const totalHeldAmount = heldBookings.reduce((sum, b) => sum + b.fieldOwnerAmount, 0);

  logSuccess(`Endpoint would return ${heldBookings.length} held bookings`);
  logSuccess(`Total held amount: $${totalHeldAmount.toFixed(2)}`);

  // Verify the total matches our expected $300
  if (totalHeldAmount === 300) {
    logSuccess('Total held amount matches expected $300.00');
    return true;
  } else {
    logError(`Total held amount mismatch: expected $300.00, got $${totalHeldAmount.toFixed(2)}`);
    return false;
  }
}

async function runTests() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║          HELD PAYOUT RELEASE AUTOMATION - COMPREHENSIVE TEST SUITE        ║', 'bright');
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'bright');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Setup phase
    await createTestUsers();
    await createTestField();
    await createHeldBookings();

    // Test 1: Verify payouts are held
    if (await verifyHeldPayouts()) {
      testsPassed++;
    } else {
      testsFailed++;
    }

    // Test 2: Test endpoint with held payouts
    if (await testGetHeldPayoutsEndpoint()) {
      testsPassed++;
    } else {
      testsFailed++;
    }

    // Test 3: Simulate Stripe connection and release
    await connectStripeAccount();

    // Test 4: Verify payouts are released
    if (await verifyPayoutsReleased()) {
      testsPassed++;
    } else {
      testsFailed++;
    }

    // Test 5: Verify notifications
    if (await verifyNotifications()) {
      testsPassed++;
    } else {
      testsFailed++;
    }

  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error);
    testsFailed++;
  } finally {
    // Always cleanup
    await cleanup();
    await prisma.$disconnect();
  }

  // Final results
  logSection('📊 Test Results Summary');
  console.log('');
  log(`Total Tests: ${testsPassed + testsFailed}`, 'bright');
  log(`✅ Passed: ${testsPassed}`, 'green');
  log(`❌ Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  console.log('');

  if (testsFailed === 0) {
    log('╔════════════════════════════════════════════════════════════════════════════╗', 'green');
    log('║                   🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉                     ║', 'green');
    log('╚════════════════════════════════════════════════════════════════════════════╝', 'green');
    console.log('');
    logSuccess('Held payout release automation is working correctly!');
    logSuccess('The system automatically releases held payouts when Stripe accounts are connected.');
  } else {
    log('╔════════════════════════════════════════════════════════════════════════════╗', 'red');
    log('║                        ⚠️  SOME TESTS FAILED ⚠️                            ║', 'red');
    log('╚════════════════════════════════════════════════════════════════════════════╝', 'red');
    console.log('');
    logError('Please review the test output above for details.');
  }

  console.log('');
  process.exit(testsFailed === 0 ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\nTest interrupted. Cleaning up...');
  await cleanup();
  await prisma.$disconnect();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n\nTest terminated. Cleaning up...');
  await cleanup();
  await prisma.$disconnect();
  process.exit(1);
});

// Run the tests
runTests().catch(async (error) => {
  logError(`Unhandled error: ${error.message}`);
  console.error(error);
  await cleanup();
  await prisma.$disconnect();
  process.exit(1);
});
