const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function setupDogOwnerWithRecurring() {
  try {
    console.log('🐕 Setting up dog owner with recurring bookings...\n');
    
    const hashedPassword = await bcrypt.hash('dogowner123', 10);
    
    // Create or update a dog owner user
    let dogOwner = await prisma.user.findFirst({
      where: {
        email: 'dogowner@test.com'
      }
    });
    
    if (dogOwner) {
      // Update existing user
      dogOwner = await prisma.user.update({
        where: { id: dogOwner.id },
        data: {
          password: hashedPassword,
          emailVerified: new Date(),
          role: 'DOG_OWNER'
        }
      });
      console.log('✅ Updated existing dog owner');
    } else {
      // Create new user
      dogOwner = await prisma.user.create({
        data: {
          email: 'dogowner@test.com',
          password: hashedPassword,
          name: 'Dog Owner Test',
          role: 'DOG_OWNER',
          emailVerified: new Date(),
          phone: '+1234567890'
        }
      });
      console.log('✅ Created new dog owner');
    }
    
    // Find available fields
    const fields = await prisma.field.findMany({
      take: 2
    });
    
    if (fields.length === 0) {
      console.log('❌ No fields found. Please create some fields first.');
      return;
    }
    
    console.log('✅ Found', fields.length, 'fields');
    
    // Clear existing subscriptions for this user
    await prisma.subscription.deleteMany({
      where: { userId: dogOwner.id }
    });
    console.log('✅ Cleared existing subscriptions');
    
    // Create weekly subscription
    const weeklySubscription = await prisma.subscription.create({
      data: {
        userId: dogOwner.id,
        fieldId: fields[0].id,
        stripeSubscriptionId: `sub_test_weekly_${Date.now()}`,
        stripeCustomerId: `cus_test_${dogOwner.id}`,
        status: 'active',
        interval: 'weekly',
        intervalCount: 1,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        timeSlot: '10:00AM - 11:00AM',
        dayOfWeek: 'Tuesday',
        startTime: '10:00AM',
        endTime: '11:00AM',
        numberOfDogs: 2,
        totalPrice: 40,
        nextBillingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
    });
    
    console.log('✅ Created weekly subscription for field:', fields[0].name);
    
    // Create monthly subscription if there's a second field
    if (fields.length > 1) {
      const monthlySubscription = await prisma.subscription.create({
        data: {
          userId: dogOwner.id,
          fieldId: fields[1].id,
          stripeSubscriptionId: `sub_test_monthly_${Date.now()}`,
          stripeCustomerId: `cus_test_${dogOwner.id}`,
          status: 'active',
          interval: 'monthly',
          intervalCount: 1,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
          timeSlot: '3:00PM - 4:00PM',
          dayOfMonth: 20,
          startTime: '3:00PM',
          endTime: '4:00PM',
          numberOfDogs: 1,
          totalPrice: 60,
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
        stripeCustomerId: `cus_test_${dogOwner.id}`,
        status: 'active',
        interval: 'weekly',
        intervalCount: 1,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: true,
        timeSlot: '5:00PM - 6:00PM',
        dayOfWeek: 'Saturday',
        startTime: '5:00PM',
        endTime: '6:00PM',
        numberOfDogs: 3,
        totalPrice: 35,
        nextBillingDate: null,
      }
    });
    
    console.log('✅ Created subscription that will cancel at period end');
    
    console.log('\n🎉 Setup complete!');
    console.log('\n📧 Dog Owner Credentials:');
    console.log('  Email: dogowner@test.com');
    console.log('  Password: dogowner123');
    console.log('\n📝 Recurring Bookings Created:');
    console.log('  - 1 Weekly subscription (Active)');
    fields.length > 1 && console.log('  - 1 Monthly subscription (Active)');
    console.log('  - 1 Weekly subscription (Canceling at period end)');
    console.log('\n🌐 Visit http://localhost:3001/login');
    console.log('   Login with the credentials above');
    console.log('   Then go to My Bookings → Recurring tab');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupDogOwnerWithRecurring();