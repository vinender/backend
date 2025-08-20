const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { createNotification } = require('./src/controllers/notification.controller');

const prisma = new PrismaClient();

async function testNotificationDirectly() {
  console.log('Testing Notification System Directly...\n');
  
  try {
    // 1. Find or create a test user
    console.log('1. Finding or creating test user...');
    let user = await prisma.user.findUnique({
      where: { email: 'notification-test@example.com' }
    });
    
    if (!user) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      user = await prisma.user.create({
        data: {
          email: 'notification-test@example.com',
          password: hashedPassword,
          name: 'Notification Test User',
          role: 'DOG_OWNER'
        }
      });
      console.log('✓ Created test user');
    } else {
      console.log('✓ Found existing test user');
    }
    
    console.log('User ID:', user.id);
    
    // 2. Check if notifications collection exists
    console.log('\n2. Checking notifications collection...');
    const notificationCount = await prisma.notification.count();
    console.log(`✓ Notifications collection exists with ${notificationCount} records`);
    
    // 3. Create a test notification directly using createNotification function
    console.log('\n3. Creating test notification using createNotification function...');
    const notification = await createNotification({
      userId: user.id,
      type: 'test_notification',
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working',
      data: { test: true, timestamp: new Date().toISOString() }
    });
    
    if (notification) {
      console.log('✓ Notification created successfully:', notification);
    } else {
      console.log('⚠️  Notification creation returned null (check console logs above)');
    }
    
    // 4. Verify notification was saved to database
    console.log('\n4. Verifying notification in database...');
    const savedNotification = await prisma.notification.findFirst({
      where: { 
        userId: user.id,
        type: 'test_notification'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (savedNotification) {
      console.log('✓ Notification found in database:', savedNotification);
      
      // 5. Clean up - delete the test notification
      console.log('\n5. Cleaning up test notification...');
      await prisma.notification.delete({
        where: { id: savedNotification.id }
      });
      console.log('✓ Test notification deleted');
    } else {
      console.log('⚠️  Notification not found in database');
    }
    
    // 6. Check WebSocket status
    console.log('\n6. Checking WebSocket status...');
    if (global.io) {
      console.log('✓ WebSocket server (global.io) is available');
    } else {
      console.log('⚠️  WebSocket server (global.io) is NOT available');
      console.log('   Make sure the server is running with WebSocket initialized');
    }
    
    console.log('\n✅ Notification system test completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationDirectly();