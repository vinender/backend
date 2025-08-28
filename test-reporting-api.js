const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

// Test user tokens (you'll need to replace with actual tokens)
const testUsers = {
  fieldOwner: {
    email: 'fieldowner@test.com',
    password: 'Test123!@#'
  },
  dogOwner: {
    email: 'dogowner@test.com',
    password: 'Test123!@#'
  }
};

async function login(email, password) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data.data.token;
  } catch (error) {
    console.error(`Login failed for ${email}:`, error.response?.data || error.message);
    return null;
  }
}

async function getUserId(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data.data.id;
  } catch (error) {
    console.error('Failed to get user info:', error.response?.data || error.message);
    return null;
  }
}

async function testReporting() {
  console.log('🔍 Testing User Reporting System...\n');

  // 1. Login as field owner
  console.log('1️⃣ Logging in as field owner...');
  let fieldOwnerToken = await login(testUsers.fieldOwner.email, testUsers.fieldOwner.password);
  if (!fieldOwnerToken) {
    console.log('⚠️  Field owner not found. Creating test user...');
    // Create field owner
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        name: 'Test Field Owner',
        email: testUsers.fieldOwner.email,
        password: testUsers.fieldOwner.password,
        role: 'FIELD_OWNER'
      });
      console.log('✅ Field owner created');
      fieldOwnerToken = await login(testUsers.fieldOwner.email, testUsers.fieldOwner.password);
    } catch (error) {
      console.error('Failed to create field owner:', error.response?.data || error.message);
    }
  }

  // 2. Login as dog owner
  console.log('2️⃣ Logging in as dog owner...');
  let dogOwnerToken = await login(testUsers.dogOwner.email, testUsers.dogOwner.password);
  if (!dogOwnerToken) {
    console.log('⚠️  Dog owner not found. Creating test user...');
    // Create dog owner
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        name: 'Test Dog Owner',
        email: testUsers.dogOwner.email,
        password: testUsers.dogOwner.password,
        role: 'DOG_OWNER'
      });
      console.log('✅ Dog owner created');
      dogOwnerToken = await login(testUsers.dogOwner.email, testUsers.dogOwner.password);
    } catch (error) {
      console.error('Failed to create dog owner:', error.response?.data || error.message);
    }
  }

  if (!fieldOwnerToken || !dogOwnerToken) {
    console.error('❌ Failed to get tokens for test users');
    return;
  }

  // Get user IDs
  const fieldOwnerId = await getUserId(fieldOwnerToken);
  const dogOwnerId = await getUserId(dogOwnerToken);

  if (!fieldOwnerId || !dogOwnerId) {
    console.error('❌ Failed to get user IDs');
    return;
  }

  console.log(`\n✅ Test users ready:`);
  console.log(`   Field Owner ID: ${fieldOwnerId}`);
  console.log(`   Dog Owner ID: ${dogOwnerId}\n`);

  // 3. Test field owner reporting dog owner
  console.log('3️⃣ Testing field owner reporting dog owner...');
  try {
    const reportResponse = await axios.post(
      `${API_BASE_URL}/user-reports/report`,
      {
        reportedUserId: dogOwnerId,
        reportOption: 'inappropriate_behavior',
        reason: 'Test report from field owner'
      },
      {
        headers: {
          'Authorization': `Bearer ${fieldOwnerToken}`
        }
      }
    );
    console.log('✅ Field owner successfully reported dog owner');
    console.log('   Report ID:', reportResponse.data.data.id);
  } catch (error) {
    console.error('❌ Field owner failed to report dog owner:', error.response?.data || error.message);
  }

  // 4. Test dog owner reporting field owner
  console.log('\n4️⃣ Testing dog owner reporting field owner...');
  try {
    const reportResponse = await axios.post(
      `${API_BASE_URL}/user-reports/report`,
      {
        reportedUserId: fieldOwnerId,
        reportOption: 'spam',
        reason: 'Test report from dog owner'
      },
      {
        headers: {
          'Authorization': `Bearer ${dogOwnerToken}`
        }
      }
    );
    console.log('✅ Dog owner successfully reported field owner');
    console.log('   Report ID:', reportResponse.data.data.id);
  } catch (error) {
    console.error('❌ Dog owner failed to report field owner:', error.response?.data || error.message);
  }

  // 5. Test blocking functionality
  console.log('\n5️⃣ Testing field owner blocking dog owner...');
  try {
    const blockResponse = await axios.post(
      `${API_BASE_URL}/user-blocks/block`,
      {
        blockedUserId: dogOwnerId,
        reason: 'Test block'
      },
      {
        headers: {
          'Authorization': `Bearer ${fieldOwnerToken}`
        }
      }
    );
    console.log('✅ Field owner successfully blocked dog owner');
    console.log('   Block ID:', blockResponse.data.data.id);
  } catch (error) {
    console.error('❌ Field owner failed to block dog owner:', error.response?.data || error.message);
  }

  // 6. Check block status
  console.log('\n6️⃣ Checking block status...');
  try {
    const statusResponse = await axios.get(
      `${API_BASE_URL}/user-blocks/status/${dogOwnerId}`,
      {
        headers: {
          'Authorization': `Bearer ${fieldOwnerToken}`
        }
      }
    );
    console.log('✅ Block status retrieved:');
    console.log('   Is blocked:', statusResponse.data.data.isBlocked);
    console.log('   Can chat:', statusResponse.data.data.canChat);
  } catch (error) {
    console.error('❌ Failed to check block status:', error.response?.data || error.message);
  }

  // 7. Test unblocking
  console.log('\n7️⃣ Testing unblock functionality...');
  try {
    const unblockResponse = await axios.post(
      `${API_BASE_URL}/user-blocks/unblock`,
      {
        blockedUserId: dogOwnerId
      },
      {
        headers: {
          'Authorization': `Bearer ${fieldOwnerToken}`
        }
      }
    );
    console.log('✅ Field owner successfully unblocked dog owner');
  } catch (error) {
    console.error('❌ Field owner failed to unblock dog owner:', error.response?.data || error.message);
  }

  console.log('\n✅ Testing complete!');
}

// Run the tests
testReporting().catch(console.error);