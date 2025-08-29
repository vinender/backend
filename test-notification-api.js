const axios = require('axios');

async function testNotificationAPI() {
  try {
    console.log('=== Testing Notification API ===\n');
    
    // First, let's login to get a token
    console.log('1. Logging in as dogowner@test.com...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'dogowner@test.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    console.log('Login successful!');
    console.log('User ID:', user.id);
    console.log('Token:', token.substring(0, 50) + '...');
    console.log('\n');
    
    // Test fetching notifications
    console.log('2. Fetching notifications...');
    const notificationsResponse = await axios.get('http://localhost:5001/api/notifications', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Notifications response:');
    console.log('  - Success:', notificationsResponse.data.success);
    console.log('  - Total notifications:', notificationsResponse.data.data.length);
    console.log('  - Unread count:', notificationsResponse.data.unreadCount);
    
    if (notificationsResponse.data.data.length > 0) {
      console.log('\nNotifications:');
      notificationsResponse.data.data.forEach((n, i) => {
        console.log(`  ${i + 1}. ${n.title}`);
        console.log(`     Type: ${n.type}`);
        console.log(`     Message: ${n.message}`);
        console.log(`     Read: ${n.read ? 'Yes' : 'No'}`);
        console.log(`     Created: ${new Date(n.createdAt).toLocaleString()}`);
        console.log('');
      });
    }
    
    // Test unread count endpoint
    console.log('3. Testing unread count endpoint...');
    const unreadResponse = await axios.get('http://localhost:5001/api/notifications/unread-count', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Unread count response:');
    console.log('  - Success:', unreadResponse.data.success);
    console.log('  - Count:', unreadResponse.data.count);
    
  } catch (error) {
    console.error('Error testing API:', error.response?.data || error.message);
  }
}

testNotificationAPI();