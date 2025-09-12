const axios = require('axios');

async function testCommissionAPI() {
  try {
    // First login to get token
    const loginResponse = await axios.post('http://localhost:5001/api/admin/login', {
      email: 'admin@fieldsy.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful! Token obtained.');
    
    // Test commission field-owners endpoint
    const fieldOwnersResponse = await axios.get('http://localhost:5001/api/commission/field-owners', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\nField Owners Response:');
    console.log('Success:', fieldOwnersResponse.data.success);
    console.log('Field Owners Count:', fieldOwnersResponse.data.data?.fieldOwners?.length || 0);
    console.log('Default Commission Rate:', fieldOwnersResponse.data.data?.defaultCommissionRate);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.error('The commission routes may not be registered in the backend.');
    }
  }
}

testCommissionAPI();