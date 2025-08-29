const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNotificationCreation() {
  try {
    console.log('=== Testing Notification Creation ===\n');
    
    // Find a test user
    const users = await prisma.user.findMany({
      take: 2,
      orderBy: { createdAt: 'desc' }
    });
    
    if (users.length < 2) {
      console.log('Need at least 2 users to test notifications');
      return;
    }
    
    const user1 = users[0];
    const user2 = users[1];
    
    console.log('User 1:', { id: user1.id, email: user1.email, role: user1.role });
    console.log('User 2:', { id: user2.id, email: user2.email, role: user2.role });
    console.log('\n');
    
    // Create a test notification
    console.log('Creating test notification for User 1...');
    const notification = await prisma.notification.create({
      data: {
        userId: user1.id,
        type: 'test_notification',
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working',
        data: {
          testField: 'test value',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    console.log('Notification created successfully:');
    console.log('  - ID:', notification.id);
    console.log('  - User ID:', notification.userId);
    console.log('  - Title:', notification.title);
    console.log('  - Type:', notification.type);
    console.log('  - Created At:', notification.createdAt);
    console.log('\n');
    
    // Verify it was saved
    const savedNotification = await prisma.notification.findUnique({
      where: { id: notification.id }
    });
    
    if (savedNotification) {
      console.log('✅ Notification successfully saved to database');
    } else {
      console.log('❌ Failed to save notification to database');
    }
    
    // Check unread count for user
    const unreadCount = await prisma.notification.count({
      where: {
        userId: user1.id,
        read: false
      }
    });
    
    console.log(`\nUser 1 has ${unreadCount} unread notifications`);
    
    // List all notifications for user 1
    const allNotifications = await prisma.notification.findMany({
      where: { userId: user1.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`\nLast 5 notifications for User 1:`);
    allNotifications.forEach((n, i) => {
      console.log(`  ${i + 1}. ${n.title} (${n.type}) - ${n.read ? 'Read' : 'Unread'}`);
    });
    
  } catch (error) {
    console.error('Error testing notification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationCreation();