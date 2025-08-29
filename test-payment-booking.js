const axios = require('axios');

async function testPaymentBooking() {
  try {
    console.log('=== Testing Payment and Booking Flow ===\n');
    
    // 1. Login as dog owner
    console.log('1. Logging in as dog owner...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'dogowner@test.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    console.log('Logged in as:', user.email);
    console.log('User ID:', user.id);
    console.log('');
    
    // 2. Get a field to book
    console.log('2. Getting field details...');
    const fieldsResponse = await axios.get('http://localhost:5001/api/fields');
    const field = fieldsResponse.data.data[0];
    
    if (!field) {
      console.log('No fields available');
      return;
    }
    
    console.log('Field:', field.name);
    console.log('Field ID:', field.id);
    console.log('Field Owner ID:', field.ownerId);
    console.log('');
    
    // 3. Create payment intent (simulating booking)
    console.log('3. Creating payment intent for booking...');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    try {
      const paymentResponse = await axios.post(
        'http://localhost:5001/api/payments/create-payment-intent',
        {
          fieldId: field.id,
          numberOfDogs: 2,
          date: dateStr,
          timeSlot: '10:00AM - 11:00AM',
          repeatBooking: 'None',
          amount: 50.00 // Example amount
          // Note: Not providing paymentMethodId to simulate new card flow
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Payment intent created!');
      console.log('Booking ID:', paymentResponse.data.bookingId);
      console.log('Payment succeeded:', paymentResponse.data.paymentSucceeded);
      console.log('');
      
      // 4. Wait for notifications to process
      console.log('4. Waiting for notifications...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 5. Check notifications
      console.log('5. Checking notifications...');
      const notificationsResponse = await axios.get('http://localhost:5001/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Total notifications:', notificationsResponse.data.data.length);
      console.log('Unread count:', notificationsResponse.data.unreadCount);
      
      if (notificationsResponse.data.data.length > 0) {
        console.log('\nLatest notifications:');
        notificationsResponse.data.data.slice(0, 3).forEach((n, i) => {
          console.log(`  ${i + 1}. ${n.title}`);
          console.log(`     Type: ${n.type}`);
          console.log(`     Message: ${n.message}`);
          console.log('');
        });
      }
      
    } catch (error) {
      console.error('Payment/Booking error:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Test error:', error.response?.data || error.message);
  }
}

testPaymentBooking();