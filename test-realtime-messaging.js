const io = require('socket.io-client');
const fetch = require('node-fetch');

// Test accounts
const dogOwner = {
  email: 'vinendersingh91@gmail.com',
  password: 'Test@123',
  role: 'DOG_OWNER'
};

const fieldOwner = {
  email: 'vinendersingh91@gmail.com',
  password: 'Test@123',
  role: 'FIELD_OWNER'
};

const API_URL = 'http://localhost:5001/api';
const SOCKET_URL = 'http://localhost:5001';

async function login(email, password, role) {
  console.log(`\nLogging in as ${role}...`);
  
  // Login with email and password
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  console.log(`✅ Logged in as ${role}: ${data.data.user.name} (${data.data.user.id})`);
  return data.data;
}

async function getConversations(token) {
  const response = await fetch(`${API_URL}/chat/conversations`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get conversations: ${response.status}`);
  }
  
  const data = await response.json();
  return data.conversations || [];
}

async function sendMessage(token, conversationId, content, receiverId) {
  const response = await fetch(`${API_URL}/chat/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      conversationId,
      content,
      receiverId
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

async function testRealtimeMessaging() {
  try {
    console.log('🚀 Starting Real-time Messaging Test\n');
    console.log('=' .repeat(50));
    
    // Login both users
    const dogOwnerAuth = await login(dogOwner.email, dogOwner.password, dogOwner.role);
    const fieldOwnerAuth = await login(fieldOwner.email, fieldOwner.password, fieldOwner.role);
    
    // Get conversations for dog owner
    const conversations = await getConversations(dogOwnerAuth.token);
    console.log(`\n📋 Found ${conversations.length} conversations`);
    
    if (conversations.length === 0) {
      console.log('❌ No conversations found. Please create a conversation first.');
      return;
    }
    
    const conversation = conversations[0];
    const receiverId = conversation.participants.find(id => id !== dogOwnerAuth.user.id);
    console.log(`\n💬 Using conversation: ${conversation.id}`);
    console.log(`   Participants: ${conversation.participants.join(', ')}`);
    
    // Create socket connections
    console.log('\n🔌 Creating socket connections...');
    
    const dogOwnerSocket = io(SOCKET_URL, {
      auth: { token: dogOwnerAuth.token }
    });
    
    const fieldOwnerSocket = io(SOCKET_URL, {
      auth: { token: fieldOwnerAuth.token }
    });
    
    // Set up socket event listeners
    const setupSocketListeners = (socket, userName) => {
      socket.on('connect', () => {
        console.log(`✅ ${userName} connected to socket`);
        socket.emit('join-conversation', conversation.id);
      });
      
      socket.on('disconnect', () => {
        console.log(`❌ ${userName} disconnected from socket`);
      });
      
      socket.on('new-message', (message) => {
        console.log(`\n📨 ${userName} received new message:`, {
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          timestamp: new Date(message.createdAt).toLocaleTimeString()
        });
      });
      
      socket.on('new-message-notification', (data) => {
        console.log(`\n🔔 ${userName} received notification:`, data.message?.content);
      });
      
      socket.onAny((eventName, ...args) => {
        if (!['connect', 'disconnect', 'new-message', 'new-message-notification'].includes(eventName)) {
          console.log(`📡 ${userName} received event: ${eventName}`);
        }
      });
    };
    
    setupSocketListeners(dogOwnerSocket, 'Dog Owner');
    setupSocketListeners(fieldOwnerSocket, 'Field Owner');
    
    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Send test messages
    console.log('\n📤 Sending test messages...');
    console.log('=' .repeat(50));
    
    // Dog owner sends message
    const timestamp = new Date().toLocaleTimeString();
    const message1 = await sendMessage(
      dogOwnerAuth.token,
      conversation.id,
      `Test message from Dog Owner at ${timestamp}`,
      receiverId
    );
    console.log(`\n✅ Dog Owner sent message: "${message1.content}"`);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Field owner sends message
    const timestamp2 = new Date().toLocaleTimeString();
    const message2 = await sendMessage(
      fieldOwnerAuth.token,
      conversation.id,
      `Reply from Field Owner at ${timestamp2}`,
      dogOwnerAuth.user.id
    );
    console.log(`\n✅ Field Owner sent message: "${message2.content}"`);
    
    // Wait to see if messages are received
    console.log('\n⏳ Waiting for real-time delivery...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Clean up
    console.log('\n🧹 Cleaning up connections...');
    dogOwnerSocket.close();
    fieldOwnerSocket.close();
    
    console.log('\n✨ Test completed!');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testRealtimeMessaging();