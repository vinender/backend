const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestRecurringBookings() {
  try {
    console.log('🔄 Creating test recurring bookings...\n');
    
    // Find a dog owner user
    const dogOwner = await prisma.user.findFirst({
      where: {
        role: 'DOG_OWNER'
      }
    });
    
    if (!dogOwner) {
      console.log('❌ No dog owner found. Please create one first.');
      return;
    }
    
    console.log('✅ Found dog owner:', dogOwner.email);
    
    // Find some fields
    const fields = await prisma.field.findMany({
      take: 2
    });
    
    if (fields.length === 0) {
      console.log('❌ No fields found. Please create some fields first.');
      return;
    }
    
    console.log('✅ Found', fields.length, 'fields');
    
    // Create weekly subscription for first field
    const weeklySubscription = await prisma.subscription.create({
      data: {
        userId: dogOwner.id,
        fieldId: fields[0].id,
        stripeSubscriptionId: `sub_test_weekly_${Date.now()}`,
        stripeCustomerId: `cus_test_${Date.now()}`,
        status: 'active',
        interval: 'weekly',
        intervalCount: 1,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        cancelAtPeriodEnd: false,
        timeSlot: '9:00AM - 10:00AM',
        dayOfWeek: 'Monday',
        startTime: '9:00AM',
        endTime: '10:00AM',
        numberOfDogs: 2,
        totalPrice: 30,
        nextBillingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
    });
    
    console.log('✅ Created weekly subscription for field:', fields[0].name);
    
    // Create monthly subscription for second field (if available)
    if (fields.length > 1) {
      const monthlySubscription = await prisma.subscription.create({
        data: {
          userId: dogOwner.id,
          fieldId: fields[1].id,
          stripeSubscriptionId: `sub_test_monthly_${Date.now()}`,
          stripeCustomerId: `cus_test_${Date.now()}`,
          status: 'active',
          interval: 'monthly',
          intervalCount: 1,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          cancelAtPeriodEnd: false,
          timeSlot: '2:00PM - 3:00PM',
          dayOfMonth: 15,
          startTime: '2:00PM',
          endTime: '3:00PM',
          numberOfDogs: 1,
          totalPrice: 50,
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }
      });
      
      console.log('✅ Created monthly subscription for field:', fields[1].name);
    }
    
    // Create a subscription that's set to cancel at period end
    const cancelingSubscription = await prisma.subscription.create({
      data: {
        userId: dogOwner.id,
        fieldId: fields[0].id,
        stripeSubscriptionId: `sub_test_canceling_${Date.now()}`,
        stripeCustomerId: `cus_test_${Date.now()}`,
        status: 'active',
        interval: 'weekly',
        intervalCount: 1,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        cancelAtPeriodEnd: true, // Will cancel at period end
        timeSlot: '4:00PM - 5:00PM',
        dayOfWeek: 'Friday',
        startTime: '4:00PM',
        endTime: '5:00PM',
        numberOfDogs: 1,
        totalPrice: 25,
        nextBillingDate: null, // No next billing since it's canceling
      }
    });
    
    console.log('✅ Created subscription that will cancel at period end');
    
    // Create some bookings for the subscriptions
    const weeklyBooking1 = await prisma.booking.create({
      data: {
        userId: dogOwner.id,
        fieldId: fields[0].id,
        subscriptionId: weeklySubscription.id,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        startTime: '9:00AM',
        endTime: '10:00AM',
        timeSlot: '9:00AM - 10:00AM',
        numberOfDogs: 2,
        totalPrice: 30,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentIntentId: `pi_test_${Date.now()}`,
        notes: 'Recurring weekly booking'
      }
    });
    
    const weeklyBooking2 = await prisma.booking.create({
      data: {
        userId: dogOwner.id,
        fieldId: fields[0].id,
        subscriptionId: weeklySubscription.id,
        date: new Date(), // Today
        startTime: '9:00AM',
        endTime: '10:00AM',
        timeSlot: '9:00AM - 10:00AM',
        numberOfDogs: 2,
        totalPrice: 30,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentIntentId: `pi_test_${Date.now() + 1}`,
        notes: 'Recurring weekly booking'
      }
    });
    
    console.log('✅ Created sample bookings for subscriptions');
    
    console.log('\n✅ Test recurring bookings created successfully!');
    console.log('\n📝 Summary:');
    console.log('  - 1 Weekly subscription (Active)');
    fields.length > 1 && console.log('  - 1 Monthly subscription (Active)');
    console.log('  - 1 Weekly subscription (Canceling at period end)');
    console.log('  - 2 Sample bookings linked to subscriptions');
    console.log('\n🌐 Visit http://localhost:3001/user/my-bookings and click on the "Recurring" tab to see them!');
    console.log('📧 Login as:', dogOwner.email);
    
  } catch (error) {
    console.error('❌ Error creating test recurring bookings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestRecurringBookings();