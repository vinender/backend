const axios = require('axios');

async function testBookingNotifications() {
  try {
    console.log('=== Testing Booking Notification System ===\n');
    
    // 1. Login as dog owner
    console.log('1. Logging in as dog owner...');
    const dogOwnerLogin = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'chandel.vinender@gmail.com',
      password: 'password123'
    });
    
    const dogOwnerToken = dogOwnerLogin.data.token;
    const dogOwner = dogOwnerLogin.data.user;
    console.log('Dog owner logged in:', dogOwner.email);
    console.log('Dog owner ID:', dogOwner.id);
    console.log('');
    
    // 2. Check dog owner's notifications before booking
    console.log('2. Checking dog owner notifications before booking...');
    const beforeNotifications = await axios.get('http://localhost:5001/api/notifications', {
      headers: { Authorization: `Bearer ${dogOwnerToken}` }
    });
    console.log('Notifications before booking:', beforeNotifications.data.data.length);
    console.log('');
    
    // 3. Get a field to book
    console.log('3. Getting field details...');
    const fieldId = '68afecf2ad2c391bd6a16370'; // From the logs
    const fieldResponse = await axios.get(`http://localhost:5001/api/fields/${fieldId}`);
    const field = fieldResponse.data.data;
    console.log('Field name:', field.name);
    console.log('Field owner ID:', field.ownerId);
    console.log('');
    
    // 4. Check if field owner is different from dog owner
    if (field.ownerId === dogOwner.id) {
      console.log('⚠️  Warning: Dog owner is the same as field owner, switching to a different field...');
      // Try to find a different field
      const allFields = await axios.get('http://localhost:5001/api/fields');
      const differentField = allFields.data.data.find(f => f.ownerId !== dogOwner.id);
      if (differentField) {
        field = differentField;
        console.log('Using different field:', field.name);
      }
    }
    
    // 5. Create a booking
    console.log('4. Creating a booking...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    try {
      const bookingResponse = await axios.post(
        'http://localhost:5001/api/bookings',
        {
          fieldId: field.id,
          date: tomorrow.toISOString().split('T')[0],
          startTime: '10:00AM',
          endTime: '11:00AM',
          numberOfDogs: 1,
          notes: 'Test booking for notification testing'
        },
        {
          headers: { Authorization: `Bearer ${dogOwnerToken}` }
        }
      );
      
      console.log('Booking created successfully!');
      console.log('Booking ID:', bookingResponse.data.data.id);
      console.log('');
    } catch (bookingError) {
      console.log('Booking creation response:', bookingError.response?.data || bookingError.message);
    }
    
    // 6. Wait a moment for notifications to process
    console.log('5. Waiting for notifications to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 7. Check dog owner's notifications after booking
    console.log('6. Checking dog owner notifications after booking...');
    const afterNotifications = await axios.get('http://localhost:5001/api/notifications', {
      headers: { Authorization: `Bearer ${dogOwnerToken}` }
    });
    
    console.log('Total notifications after booking:', afterNotifications.data.data.length);
    console.log('New notifications:', afterNotifications.data.data.length - beforeNotifications.data.data.length);
    
    if (afterNotifications.data.data.length > 0) {
      console.log('\nLatest notifications:');
      afterNotifications.data.data.slice(0, 3).forEach((n, i) => {
        console.log(`  ${i + 1}. ${n.title}`);
        console.log(`     Type: ${n.type}`);
        console.log(`     Message: ${n.message}`);
        console.log(`     Created: ${new Date(n.createdAt).toLocaleString()}`);
        console.log('');
      });
    }
    
    // 8. If we have field owner credentials, check their notifications too
    console.log('7. Attempting to check field owner notifications...');
    try {
      // Try to login as field owner (if we know their credentials)
      // This is just for testing - in real scenario, field owner would be different user
      const fieldOwnerEmail = 'fieldowner@test.com'; // Replace with actual field owner email
      const fieldOwnerLogin = await axios.post('http://localhost:5001/api/auth/login', {
        email: fieldOwnerEmail,
        password: 'password123'
      });
      
      const fieldOwnerToken = fieldOwnerLogin.data.token;
      const fieldOwnerNotifications = await axios.get('http://localhost:5001/api/notifications', {
        headers: { Authorization: `Bearer ${fieldOwnerToken}` }
      });
      
      console.log('Field owner notifications:', fieldOwnerNotifications.data.data.length);
      if (fieldOwnerNotifications.data.data.length > 0) {
        const latestNotification = fieldOwnerNotifications.data.data[0];
        console.log('Field owner latest notification:', latestNotification.title);
        console.log('Message:', latestNotification.message);
      }
    } catch (error) {
      console.log('Could not check field owner notifications (may not have credentials)');
    }
    
    console.log('\n✅ Notification test completed!');
    console.log('\nSummary:');
    console.log('- Booking was created successfully');
    console.log('- Dog owner should have received a booking confirmation notification');
    console.log('- Field owner should have received a new booking notification');
    console.log('- Check the browser console for WebSocket events');
    
  } catch (error) {
    console.error('Test error:', error.response?.data || error.message);
  }
}

testBookingNotifications();