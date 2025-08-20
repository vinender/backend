const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testNotificationSystem() {
  console.log('Testing Notification System...\n');
  
  try {
    // 1. Find or create a test user
    console.log('1. Finding or creating test user...');
    let user = await prisma.user.findFirst({
      where: { 
        email: 'notification-test@example.com',
        role: 'DOG_OWNER'
      }
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
    
    // 3. Create a test notification directly in the database
    console.log('\n3. Creating test notification directly in database...');
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'test_notification',
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working',
        data: { test: true, timestamp: new Date().toISOString() }
      }
    });
    
    console.log('✓ Notification created successfully:', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      createdAt: notification.createdAt
    });
    
    // 4. Verify notification was saved
    console.log('\n4. Verifying notification in database...');
    const savedNotification = await prisma.notification.findUnique({
      where: { id: notification.id }
    });
    
    if (savedNotification) {
      console.log('✓ Notification verified in database');
      
      // 5. Get all notifications for the user
      console.log('\n5. Getting all notifications for user...');
      const userNotifications = await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log(`✓ Found ${userNotifications.length} notification(s) for user`);
      userNotifications.forEach((n, index) => {
        console.log(`  ${index + 1}. ${n.title} (${n.type}) - Read: ${n.read}`);
      });
      
      // 6. Mark notification as read
      console.log('\n6. Marking notification as read...');
      const updatedNotification = await prisma.notification.update({
        where: { id: notification.id },
        data: { 
          read: true,
          readAt: new Date()
        }
      });
      console.log('✓ Notification marked as read');
      
      // 7. Clean up - delete the test notification
      console.log('\n7. Cleaning up test notification...');
      await prisma.notification.delete({
        where: { id: notification.id }
      });
      console.log('✓ Test notification deleted');
    } else {
      console.log('⚠️  Notification not found in database');
    }
    
    console.log('\n✅ Notification system test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Make sure the backend server is running with WebSocket support');
    console.log('2. Login to the frontend application');
    console.log('3. Create a review or booking to trigger real notifications');
    console.log('4. Check the notification sidebar to see real-time updates');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationSystem();