const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:5001/api/admin/login', {
      email: 'admin@fieldsy.com',
      password: 'Admin123!'
    });
    
    console.log('Login successful!');
    console.log('Token:', response.data.token);
    console.log('Admin:', response.data.admin);
    
    // Test verify endpoint
    const verifyResponse = await axios.get('http://localhost:5001/api/admin/verify', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    
    console.log('\nVerify successful!');
    console.log('Admin data:', verifyResponse.data.admin);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testLogin();