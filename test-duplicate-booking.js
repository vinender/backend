const fetch = require('node-fetch');

async function testDuplicateBooking() {
  console.log('🧪 Testing Duplicate Booking Prevention...\n');
  
  // Test configuration
  const API_URL = 'http://localhost:5000/api';
  const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3MDQ1NmE0YjIxZWJjOWI1NTU0OGFlNiIsImVtYWlsIjoidGVzdEBnbWFpbC5jb20iLCJyb2xlIjoidXNlciIsInNlc3Npb25JZCI6IjJjMTQwMGVlLTBkMzEtNDA0MS05YTBmLTkzODFhMWNkNGU5MyIsImlhdCI6MTcyNzI5MTEwNywiZXhwIjoxNzI3ODk1OTA3fQ.sXLGqOy8VKEeVRxGz-9TJNPnTQzK4JGhP8N8m_B9K1A'; // Replace with actual token
  
  // Test booking data
  const bookingData = {
    fieldId: '66e7e690c90b93cc8b5c8aff',
    numberOfDogs: 2,
    date: '2025-10-15',
    timeSlot: '2:00PM - 3:00PM',
    repeatBooking: 'none',
    amount: 45
  };

  try {
    console.log('📤 Sending first payment request...');
    
    // First request
    const response1 = await fetch(`${API_URL}/payments/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(bookingData)
    });
    
    const data1 = await response1.json();
    console.log('✅ First request response:', {
      status: response1.status,
      bookingId: data1.bookingId,
      isDuplicate: data1.isDuplicate,
      message: data1.message
    });
    
    // Wait a moment
    console.log('\n⏳ Waiting 2 seconds before second request...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Second request (should detect duplicate)
    console.log('📤 Sending duplicate payment request...');
    
    const response2 = await fetch(`${API_URL}/payments/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(bookingData)
    });
    
    const data2 = await response2.json();
    console.log('✅ Second request response:', {
      status: response2.status,
      bookingId: data2.bookingId,
      isDuplicate: data2.isDuplicate,
      message: data2.message
    });
    
    // Verify results
    console.log('\n📊 Test Results:');
    
    if (data2.isDuplicate === true) {
      console.log('✅ SUCCESS: Duplicate booking was properly detected!');
      console.log(`   - Same booking ID returned: ${data1.bookingId === data2.bookingId}`);
      console.log(`   - Duplicate flag set: ${data2.isDuplicate === true}`);
    } else {
      console.log('❌ FAILURE: Duplicate booking was NOT detected!');
      console.log(`   - First booking ID: ${data1.bookingId}`);
      console.log(`   - Second booking ID: ${data2.bookingId}`);
    }
    
    // Simulate rapid concurrent requests
    console.log('\n🔥 Testing rapid concurrent requests...\n');
    
    const concurrentBookingData = {
      ...bookingData,
      date: '2025-10-16', // Different date to avoid conflict with previous test
      timeSlot: '3:00PM - 4:00PM'
    };
    
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        fetch(`${API_URL}/payments/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(concurrentBookingData)
        }).then(r => r.json())
      );
    }
    
    const results = await Promise.all(promises);
    
    const duplicates = results.filter(r => r.isDuplicate === true);
    const successes = results.filter(r => !r.isDuplicate && r.bookingId);
    
    console.log('📊 Concurrent Request Results:');
    console.log(`   - Total requests: 5`);
    console.log(`   - Successful bookings: ${successes.length}`);
    console.log(`   - Duplicates detected: ${duplicates.length}`);
    
    if (successes.length === 1 && duplicates.length === 4) {
      console.log('✅ SUCCESS: Only one booking was created from concurrent requests!');
    } else {
      console.log('⚠️  WARNING: Multiple bookings may have been created!');
      console.log('   Successful booking IDs:', successes.map(s => s.bookingId));
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('   Make sure the backend server is running and you have a valid auth token.');
  }
}

// Run the test
testDuplicateBooking();