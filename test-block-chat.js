const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testBlockedChat() {
  console.log('🔍 Testing Blocked Chat Functionality...\n');

  try {
    // 1. Login as test users
    console.log('1️⃣ Logging in test users...');
    const fieldOwnerRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'fieldowner@test.com',
      password: 'Test123!@#'
    });
    const fieldOwnerToken = fieldOwnerRes.data.data.token;
    const fieldOwnerId = fieldOwnerRes.data.data.user.id;

    const dogOwnerRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'dogowner@test.com',
      password: 'Test123!@#'
    });
    const dogOwnerToken = dogOwnerRes.data.data.token;
    const dogOwnerId = dogOwnerRes.data.data.user.id;

    console.log('✅ Users logged in successfully');

    // 2. Create a conversation (simulate)
    console.log('\n2️⃣ Creating test conversation...');
    // This would normally be done through the UI or websocket
    const conversationId = '68affd53e5ed2e34a8e1f322'; // Use actual ID if available

    // 3. Field owner blocks dog owner
    console.log('\n3️⃣ Field owner blocking dog owner...');
    await axios.post(
      `${API_BASE_URL}/user-blocks/block`,
      {
        blockedUserId: dogOwnerId,
        reason: 'Test block for chat'
      },
      {
        headers: {
          'Authorization': `Bearer ${fieldOwnerToken}`
        }
      }
    );
    console.log('✅ Dog owner blocked');

    // 4. Try to send a message from field owner (should fail)
    console.log('\n4️⃣ Testing message from field owner (blocker)...');
    try {
      await axios.post(
        `${API_BASE_URL}/chat/messages`,
        {
          conversationId: conversationId,
          content: 'Test message from blocker',
          receiverId: dogOwnerId
        },
        {
          headers: {
            'Authorization': `Bearer ${fieldOwnerToken}`
          }
        }
      );
      console.log('❌ ERROR: Message sent successfully (should have been blocked)');
    } catch (error) {
      if (error.response?.data?.blocked) {
        console.log('✅ Message correctly blocked with error:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // 5. Try to send a message from dog owner (should also fail)
    console.log('\n5️⃣ Testing message from dog owner (blocked user)...');
    try {
      await axios.post(
        `${API_BASE_URL}/chat/messages`,
        {
          conversationId: conversationId,
          content: 'Test message from blocked user',
          receiverId: fieldOwnerId
        },
        {
          headers: {
            'Authorization': `Bearer ${dogOwnerToken}`
          }
        }
      );
      console.log('❌ ERROR: Message sent successfully (should have been blocked)');
    } catch (error) {
      if (error.response?.data?.blocked) {
        console.log('✅ Message correctly blocked with error:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // 6. Check block status
    console.log('\n6️⃣ Checking block status from field owner perspective...');
    const statusRes = await axios.get(
      `${API_BASE_URL}/user-blocks/status/${dogOwnerId}`,
      {
        headers: {
          'Authorization': `Bearer ${fieldOwnerToken}`
        }
      }
    );
    console.log('Block status:', statusRes.data.data);

    // 7. Unblock user
    console.log('\n7️⃣ Unblocking user...');
    await axios.post(
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
    console.log('✅ User unblocked');

    // 8. Try sending message again (should work now)
    console.log('\n8️⃣ Testing message after unblock...');
    try {
      const messageRes = await axios.post(
        `${API_BASE_URL}/chat/messages`,
        {
          conversationId: conversationId,
          content: 'Test message after unblock',
          receiverId: dogOwnerId
        },
        {
          headers: {
            'Authorization': `Bearer ${fieldOwnerToken}`
          }
        }
      );
      console.log('✅ Message sent successfully after unblock');
    } catch (error) {
      console.log('❌ Message failed after unblock:', error.response?.data || error.message);
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testBlockedChat();