const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function testFullNotificationSystem() {
  try {
    console.log('=== Testing Full Notification System ===\n');
    
    // 1. Create or get test users
    console.log('1. Setting up test users...');
    
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    
    // Create or update dog owner
    const dogOwner = await prisma.user.upsert({
      where: { email: 'testdog@example.com' },
      update: {},
      create: {
        email: 'testdog@example.com',
        name: 'Test Dog Owner',
        password: hashedPassword,
        role: 'DOG_OWNER',
        isEmailVerified: true,
        phone: '+1234567890'
      }
    });
    
    // Create or update field owner
    const fieldOwner = await prisma.user.upsert({
      where: { email: 'testfield@example.com' },
      update: {},
      create: {
        email: 'testfield@example.com',
        name: 'Test Field Owner',
        password: hashedPassword,
        role: 'FIELD_OWNER',
        isEmailVerified: true,
        phone: '+0987654321'
      }
    });
    
    console.log('Dog Owner ID:', dogOwner.id);
    console.log('Field Owner ID:', fieldOwner.id);
    console.log('');
    
    // 2. Create test notifications directly
    console.log('2. Creating test notifications directly in database...');
    
    const notification1 = await prisma.notification.create({
      data: {
        userId: dogOwner.id,
        type: 'booking_confirmed',
        title: 'Booking Confirmed!',
        message: 'Your booking for Central Park Field has been confirmed.',
        data: {
          bookingId: 'test123',
          fieldName: 'Central Park Field'
        }
      }
    });
    
    const notification2 = await prisma.notification.create({
      data: {
        userId: fieldOwner.id,
        type: 'new_booking_received',
        title: 'New Booking Request!',
        message: 'You have a new booking request for your field.',
        data: {
          bookingId: 'test456',
          dogOwnerName: 'Test Dog Owner'
        }
      }
    });
    
    console.log('Created notification for dog owner:', notification1.id);
    console.log('Created notification for field owner:', notification2.id);
    console.log('');
    
    // 3. Test API access
    console.log('3. Testing API access with JWT token...');
    
    // Generate JWT token for dog owner
    const token = jwt.sign(
      { 
        id: dogOwner.id,
        email: dogOwner.email,
        role: dogOwner.role
      },
      process.env.JWT_SECRET || 'test-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('Generated token for dog owner');
    console.log('');
    
    // 4. Fetch notifications via API
    console.log('4. Fetching notifications via API...');
    
    try {
      const response = await axios.get('http://localhost:5001/api/notifications', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('API Response:');
      console.log('  - Success:', response.data.success);
      console.log('  - Total notifications:', response.data.data.length);
      console.log('  - Unread count:', response.data.unreadCount);
      
      if (response.data.data.length > 0) {
        console.log('\nNotifications retrieved:');
        response.data.data.forEach((n, i) => {
          console.log(`  ${i + 1}. ${n.title}`);
          console.log(`     Message: ${n.message}`);
          console.log(`     Type: ${n.type}`);
          console.log(`     Read: ${n.read ? 'Yes' : 'No'}`);
        });
      }
    } catch (apiError) {
      console.error('API Error:', apiError.response?.data || apiError.message);
    }
    
    // 5. Check database directly
    console.log('\n5. Checking database directly...');
    
    const dogOwnerNotifications = await prisma.notification.findMany({
      where: { userId: dogOwner.id },
      orderBy: { createdAt: 'desc' }
    });
    
    const fieldOwnerNotifications = await prisma.notification.findMany({
      where: { userId: fieldOwner.id },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Dog Owner has ${dogOwnerNotifications.length} notifications`);
    console.log(`Field Owner has ${fieldOwnerNotifications.length} notifications`);
    
    // 6. Test WebSocket notification (simulation)
    console.log('\n6. Testing notification emit simulation...');
    
    // Import the createNotification function
    const { createNotification } = require('./src/controllers/notification.controller');
    
    // Create a notification that should trigger WebSocket
    const wsNotification = await createNotification({
      userId: dogOwner.id,
      type: 'test_websocket',
      title: 'WebSocket Test',
      message: 'This notification should be emitted via WebSocket',
      data: { timestamp: new Date().toISOString() }
    });
    
    if (wsNotification) {
      console.log('✅ WebSocket notification created successfully');
      console.log('   Check the browser console for WebSocket events');
    } else {
      console.log('❌ Failed to create WebSocket notification');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFullNotificationSystem();