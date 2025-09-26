// Test the recurring bookings API endpoint  
const axios = require('axios');

async function testRecurringAPI() {
  try {
    // First login to get token
    let loginResponse;
    try {
      loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'indiajobsairply@gmail.com',
        password: 'V$9876543210'
      });
    } catch (err) {
      loginResponse = { status: 401 };
    }

    let token;
    if (loginResponse.status !== 200) {
      console.log('Login failed. Trying alternate credentials...');
      // Try another user
      try {
        const altLogin = await axios.post('http://localhost:5000/api/auth/login', {
          email: 'dogowner@test.com',
          password: 'password123'
        });
        token = altLogin.data.token;
      } catch (err) {
        console.log('Both login attempts failed');
        return;
      }
    } else {
      token = loginResponse.data.token;
    }

    console.log('Successfully logged in. Testing recurring bookings API...\n');

    // Test the recurring bookings endpoint
    const response = await axios.get('http://localhost:5000/api/bookings/my-recurring', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      const data = response.data;
      console.log('API Response:');
      console.log('Total items:', data.total);
      
      if (data.breakdown) {
        console.log('\nBreakdown:');
        console.log('  Subscriptions:', data.breakdown.subscriptions);
        console.log('  Recurring Bookings:', data.breakdown.recurringBookings);
      }

      console.log('\nRecurring items:');
      if (data.data && data.data.length > 0) {
        data.data.forEach((item, idx) => {
          console.log(`\n${idx + 1}. ${item.type === 'subscription' ? 'SUBSCRIPTION' : 'BOOKING'}`);
          console.log(`   Field: ${item.fieldName}`);
          console.log(`   Interval: ${item.interval}`);
          console.log(`   Time: ${item.startTime} - ${item.endTime}`);
          console.log(`   Status: ${item.status}`);
          console.log(`   Price: £${item.totalPrice}`);
          if (item.repeatBooking) {
            console.log(`   RepeatBooking field: ${item.repeatBooking}`);
          }
        });
      } else {
        console.log('  No recurring bookings found');
      }
    } else {
      console.error('API Error:', response.data);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRecurringAPI();