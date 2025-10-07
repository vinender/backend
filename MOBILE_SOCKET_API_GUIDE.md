# Mobile Socket API Guide - Fieldsy Platform

## 📱 Introduction for Mobile Developers

This guide will help you implement real-time features in the Fieldsy mobile app using WebSocket (Socket.IO). You'll be able to add:
- **Real-time Chat** between dog owners and field owners
- **Live Notifications** for bookings, payments, and reviews
- **Typing Indicators** to show when someone is typing
- **Read Receipts** to show when messages are read

**No complex backend knowledge required!** Just follow the steps below.

### 📖 How This Guide is Organized

This guide takes you from zero to a fully functional real-time mobile app in clear, sequential steps:

1. **Quick Start (5 Steps)** - Get connected in 5 minutes ⚡
2. **Connection Setup** - Understand how to connect, authenticate, and handle errors
3. **Chat Implementation** - Build complete chat functionality with join/leave, send/receive, typing indicators
4. **Notifications** - Receive and display booking, payment, and review notifications
5. **Reconnection Handling** - Make your app bulletproof with automatic reconnection
6. **Complete Example** - Full working SocketService class you can copy and paste
7. **Testing & Troubleshooting** - Debug common issues with step-by-step solutions

**📚 Reading Strategy:**
- **Just getting started?** Read "Quick Start" → "Connection Setup" → "Authentication"
- **Need chat?** Read "Chat Implementation" section (includes all events: join, send, receive, typing, read receipts)
- **Need notifications?** Read "Notifications Implementation" section
- **Production ready?** Add "Reconnection Handling" for network reliability
- **Want complete code?** Jump to "Complete Mobile Implementation Example"

**💡 Pro Tip:** Each event includes WHY you need it, WHEN to use it, WHAT payload to send, and WHAT response you'll get back.

---

## 🚀 Quick Start (5 Steps)

**Goal:** Get your mobile app connected to the backend in 5 minutes.

**What you'll do:** Install package → Import → Connect → Authenticate → Listen

### Step 1: Install Socket.IO Client

**Why:** Socket.IO is the library that handles WebSocket connections for you.

**What to do:** Run this command in your mobile project directory:

```bash
npm install socket.io-client
# or if you use yarn
yarn add socket.io-client
```

**Expected result:** Package installs successfully. You should see it in your `package.json` dependencies.

---

### Step 2: Import and Connect

**Why:** You need to create a socket connection to the server.

**What to do:** Create a socket instance with the server URL:

```typescript
import io from 'socket.io-client';

const socket = io('https://fieldsy-api.indiitserver.in', {
  transports: ['websocket'],  // Use WebSocket protocol only (faster than polling)
  autoConnect: false          // Don't connect automatically (we'll control when)
});
```

**Explanation:**
- `'https://fieldsy-api.indiitserver.in'` - Production server URL (use `http://localhost:5000` for local development)
- `transports: ['websocket']` - Only use WebSocket (faster, no HTTP polling fallback)
- `autoConnect: false` - We manually control when to connect (after user logs in)

**Expected result:** You have a `socket` variable ready to use.

---

### Step 3: Connect When User Logs In

**Why:** Only authenticated users should connect to the socket server.

**What to do:** Call `socket.connect()` after successful login:

```typescript
// After successful login (e.g., in your login success handler)
function onLoginSuccess(user, token) {
  // Save user and token
  await AsyncStorage.setItem('authToken', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));

  // Now connect to socket
  socket.connect();

  // Navigate to home screen
  navigation.navigate('Home');
}
```

**Expected result:** Socket attempts to connect to the server. You'll receive a `connect` event (handled in Step 4).

---

### Step 4: Authenticate

**Why:** The server needs to verify you're a real user before allowing socket communication.

**What to do:** Listen for the `connect` event and send your authentication token:

```typescript
socket.on('connect', async () => {
  console.log('✅ Socket connected! Socket ID:', socket.id);

  // Get JWT token from storage
  const token = await AsyncStorage.getItem('authToken');

  if (token) {
    // Send authentication request
    socket.emit('authenticate', { token: token });
  } else {
    console.error('No auth token found');
    socket.disconnect();
  }
});

// Listen for authentication success
socket.on('authenticated', (data) => {
  console.log('✅ Authenticated as user:', data.userId);
  // Now you can send/receive messages and notifications
});

// Listen for authentication failure
socket.on('authentication_error', (error) => {
  console.error('❌ Authentication failed:', error.message);
  socket.disconnect();
  // Redirect to login screen
  navigation.navigate('Login');
});
```

**Explanation:**
- `socket.on('connect')` - Fires when connection is established
- `socket.emit('authenticate', { token })` - Sends your JWT token to the server
- Server verifies token and sends back `authenticated` or `authentication_error`

**Expected result:** You receive `authenticated` event with your userId. Now you can use chat and notifications!

---

### Step 5: Listen for Events

**Why:** Now that you're authenticated, you can receive real-time events.

**What to do:** Set up listeners for events you care about:

```typescript
// Receive new chat messages
socket.on('new-message', (message) => {
  console.log('📩 New message:', message.text);
  console.log('From user:', message.senderId);
  console.log('Message ID:', message._id);

  // Add message to your chat UI
  addMessageToChatScreen(message);

  // Show notification if user is not in this chat
  if (currentChatId !== message.conversationId) {
    showInAppNotification('New message', message.text);
  }
});

// Receive booking notifications
socket.on('booking-notification', (notification) => {
  console.log('🔔 Booking notification:', notification.title);

  // Show notification
  showNotification(notification.title, notification.message);

  // Update badge count
  incrementNotificationBadge();
});

// Receive payment notifications
socket.on('payment-notification', (notification) => {
  console.log('💰 Payment notification:', notification.title);
  showNotification(notification.title, notification.message);
});
```

**Expected result:** Your app receives real-time updates! Messages appear instantly, notifications show up immediately.

---

**🎉 Congratulations!** You now have a working real-time connection. Your users will see messages and notifications instantly without refreshing.

**Next steps:**
- Read "Chat Implementation" to learn how to SEND messages (not just receive)
- Read "Notifications Implementation" for all notification types
- Read "Complete Example" for a production-ready SocketService class

---

## 🔌 Connection Setup (Detailed)

**What you'll learn:** How to properly configure socket connections, handle different environments, and control when to connect/disconnect.

### Server URLs

```typescript
// Production
const SOCKET_URL = 'https://fieldsy-api.indiitserver.in';

// Staging (if available)
const SOCKET_URL = 'https://staging-api.fieldsy.com';

// Local Development
const SOCKET_URL = 'http://localhost:5000';
```

### Creating Socket Connection

```typescript
import io, { Socket } from 'socket.io-client';

// Create socket instance
const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket'],  // Use WebSocket only (faster)
  autoConnect: false,         // Manual control
  reconnection: true,         // Auto-reconnect on disconnect
  reconnectionDelay: 1000,    // Wait 1 second before retry
  reconnectionAttempts: 5,    // Try 5 times before giving up
  timeout: 10000             // 10 second timeout
});
```

### When to Connect

```typescript
// ✅ Connect when:
// - User logs in
// - User registers
// - App opens and user is already logged in

// ❌ Don't connect when:
// - User is not logged in
// - User logs out
// - App is in background (depends on your needs)
```

---

## 🔐 Authentication (Required First Step)

After connecting, you **MUST** authenticate before doing anything else.

### Step 1: Listen for Connection

```typescript
socket.on('connect', () => {
  console.log('✅ Connected! Socket ID:', socket.id);

  // Now authenticate
  authenticateSocket();
});
```

### Step 2: Send Authentication

```typescript
function authenticateSocket() {
  // Get your JWT token (same token used for REST APIs)
  const token = await AsyncStorage.getItem('authToken');

  // Send authentication request
  socket.emit('authenticate', {
    token: token
  });
}
```

**Sample Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGUxMjM0NTY3ODkwYWJjZGVmMTIzNDUiLCJpYXQiOjE3MDk1NTUyMDAsImV4cCI6MTcxMDc2NDgwMH0.abc123xyz789
```

### Step 3: Listen for Success/Failure

```typescript
// Success ✅
socket.on('authenticated', (data) => {
  console.log('✅ Authenticated!', data);
  /*
  data = {
    success: true,
    userId: "68e1234567890abcdef12345",
    message: "Authentication successful"
  }
  */

  // Now you can join conversations, send messages, etc.
  markAsAuthenticated();
});

// Failure ❌
socket.on('authentication_error', (error) => {
  console.error('❌ Authentication failed:', error);
  /*
  error = {
    message: "Invalid token" // or "Token expired"
  }
  */

  // Disconnect and ask user to log in again
  socket.disconnect();
  redirectToLogin();
});
```

---

## 💬 Chat Implementation

### Opening a Chat Screen

When user opens a conversation, join that conversation room:

```typescript
function openChatScreen(conversationId: string) {
  // 1. Join the conversation
  socket.emit('join-conversation', {
    conversationId: conversationId
  });

  // 2. Listen for confirmation
  socket.on('conversation-joined', (data) => {
    console.log('Joined conversation:', data.conversationId);
    /*
    data = {
      conversationId: "68e1234567890abcdef12345",
      success: true,
      message: "Joined conversation successfully"
    }
    */

    // 3. Now load messages from REST API
    loadMessages(conversationId);
  });
}
```

**Sample Payload:**
```json
{
  "conversationId": "68e1234567890abcdef12345"
}
```

### Sending a Message

```typescript
function sendMessage(text: string) {
  // Send the message
  socket.emit('send-message', {
    conversationId: currentConversationId,
    text: text,
    receiverId: otherUserId
  });

  // Show message in UI immediately (optimistic update)
  addMessageToUI({
    text: text,
    senderId: myUserId,
    status: 'sending',
    createdAt: new Date().toISOString()
  });
}
```

**Sample Payload:**
```json
{
  "conversationId": "68e1234567890abcdef12345",
  "text": "Hi! Is the field available tomorrow at 3 PM?",
  "receiverId": "68e9876543210fedcba09876"
}
```

**Backend Response:**
```typescript
socket.on('message-sent', (data) => {
  console.log('✅ Message sent successfully!', data);
  /*
  data = {
    success: true,
    message: {
      _id: "68eabcdef1234567890abcde",
      conversationId: "68e1234567890abcdef12345",
      senderId: "68e1234567890abcdef12345",
      receiverId: "68e9876543210fedcba09876",
      text: "Hi! Is the field available tomorrow at 3 PM?",
      read: false,
      createdAt: "2025-10-07T10:30:00.000Z",
      updatedAt: "2025-10-07T10:30:00.000Z"
    }
  }
  */

  // Update message in UI with real ID
  updateMessageInUI(data.message);
});
```

### Receiving Messages

```typescript
// Listen for incoming messages
socket.on('new-message', (message) => {
  console.log('📩 New message received:', message);
  /*
  message = {
    _id: "68eabcdef1234567890abcde",
    conversationId: "68e1234567890abcdef12345",
    senderId: "68e9876543210fedcba09876",
    receiverId: "68e1234567890abcdef12345", // You
    text: "Yes! The field is available from 3 PM to 5 PM.",
    read: false,
    createdAt: "2025-10-07T10:31:00.000Z",
    updatedAt: "2025-10-07T10:31:00.000Z"
  }
  */

  // Check if message is for current conversation
  if (message.conversationId === currentConversationId) {
    // Add to chat UI
    addMessageToUI(message);

    // Mark as read
    socket.emit('mark-messages-read', {
      conversationId: message.conversationId,
      userId: myUserId
    });
  } else {
    // Show notification badge
    incrementUnreadBadge(message.conversationId);

    // Optionally show push notification
    showPushNotification({
      title: 'New message',
      body: message.text
    });
  }
});
```

### Typing Indicators (Optional but Nice!)

```typescript
// When user starts typing
function onTextChange(text: string) {
  if (text.length > 0 && !isTyping) {
    isTyping = true;

    socket.emit('typing', {
      conversationId: currentConversationId,
      userId: myUserId
    });

    // Auto-stop after 3 seconds
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      stopTyping();
    }, 3000);
  }
}

// When user stops typing
function stopTyping() {
  isTyping = false;

  socket.emit('stop-typing', {
    conversationId: currentConversationId,
    userId: myUserId
  });
}

// When other user is typing
socket.on('typing', (data) => {
  /*
  data = {
    conversationId: "68e1234567890abcdef12345",
    userId: "68e9876543210fedcba09876"
  }
  */

  if (data.conversationId === currentConversationId) {
    showTypingIndicator(data.userId);
  }
});

// When other user stops typing
socket.on('stop-typing', (data) => {
  if (data.conversationId === currentConversationId) {
    hideTypingIndicator(data.userId);
  }
});
```

### Read Receipts

```typescript
// Mark messages as read when user opens chat
function markAsRead() {
  socket.emit('mark-messages-read', {
    conversationId: currentConversationId,
    userId: myUserId
  });
}

// Listen for read receipts
socket.on('messages-read', (data) => {
  /*
  data = {
    conversationId: "68e1234567890abcdef12345",
    userId: "68e9876543210fedcba09876",
    updatedCount: 3
  }
  */

  // Update UI to show double check marks
  markMessagesAsRead(data.conversationId);
});
```

### Leaving a Chat

```typescript
function closeChatScreen() {
  // Leave the conversation room
  socket.emit('leave-conversation', {
    conversationId: currentConversationId
  });

  // Stop typing if active
  if (isTyping) {
    stopTyping();
  }
}
```

---

## 🔔 Notifications Implementation

### Listening for All Notifications

```typescript
// General notification listener (catches all types)
socket.on('notification', (notification) => {
  console.log('🔔 New notification:', notification);
  /*
  notification = {
    _id: "68eabcdef1234567890abcde",
    userId: "68e1234567890abcdef12345", // You
    type: "BOOKING_CREATED",
    title: "New Booking Request",
    message: "You have a new booking for Green Valley Field",
    data: {
      bookingId: "68eabcdef1234567890abcde",
      fieldId: "68e1234567890abcdef12345",
      fieldName: "Green Valley Field",
      date: "2025-10-08T00:00:00.000Z",
      startTime: "15:00",
      endTime: "17:00"
    },
    read: false,
    createdAt: "2025-10-07T10:35:00.000Z",
    updatedAt: "2025-10-07T10:35:00.000Z"
  }
  */

  // Handle notification
  handleNotification(notification);
});

function handleNotification(notification: any) {
  // 1. Show in-app notification
  showInAppNotification({
    title: notification.title,
    message: notification.message,
    type: notification.type
  });

  // 2. Update notification badge
  incrementNotificationBadge();

  // 3. If app is in background, show push notification
  if (appState === 'background') {
    showPushNotification({
      title: notification.title,
      body: notification.message,
      data: notification.data
    });
  }

  // 4. Play sound (optional)
  playNotificationSound();
}
```

### Booking Notifications

```typescript
socket.on('booking-notification', (notification) => {
  /*
  notification = {
    _id: "68eabcdef1234567890abcde",
    userId: "68e1234567890abcdef12345",
    type: "BOOKING_CREATED" | "BOOKING_CONFIRMED" | "BOOKING_CANCELLED" | "BOOKING_COMPLETED",
    title: "New Booking Request",
    message: "You have a new booking for Green Valley Field on Oct 8, 2025",
    data: {
      bookingId: "68eabcdef1234567890abcde",
      fieldId: "68e1234567890abcdef12345",
      fieldName: "Green Valley Field",
      date: "2025-10-08T00:00:00.000Z",
      startTime: "15:00",
      endTime: "17:00"
    },
    read: false,
    createdAt: "2025-10-07T10:35:00.000Z"
  }
  */

  // Handle based on type
  switch (notification.type) {
    case 'BOOKING_CREATED':
      // Field owner received new booking request
      showNotification('New booking request!', notification.message);
      playSound('new-booking.mp3');
      break;

    case 'BOOKING_CONFIRMED':
      // Dog owner's booking was confirmed
      showNotification('Booking confirmed!', notification.message);
      playSound('success.mp3');
      break;

    case 'BOOKING_CANCELLED':
      // Booking was cancelled
      showNotification('Booking cancelled', notification.message);
      playSound('alert.mp3');
      break;

    case 'BOOKING_COMPLETED':
      // Booking completed, time to review
      showNotification('Booking completed!', notification.message);
      playSound('complete.mp3');
      break;
  }

  // Refresh bookings list if on bookings screen
  if (currentScreen === 'bookings') {
    refreshBookingsList();
  }
});
```

### Payment Notifications

```typescript
socket.on('payment-notification', (notification) => {
  /*
  notification = {
    _id: "68eabcdef1234567890abcde",
    userId: "68e1234567890abcdef12345",
    type: "PAYMENT_RECEIVED" | "PAYMENT_REFUNDED" | "PAYOUT_COMPLETED",
    title: "Payment Received",
    message: "You received $45.00 for your booking",
    data: {
      amount: 45.00,
      currency: "USD",
      bookingId: "68eabcdef1234567890abcde",
      payoutId: null
    },
    read: false,
    createdAt: "2025-10-07T10:40:00.000Z"
  }
  */

  showNotification(notification.title, notification.message);

  // Refresh wallet/earnings if on that screen
  if (currentScreen === 'wallet' || currentScreen === 'earnings') {
    refreshWalletData();
  }
});
```

### Review Notifications

```typescript
socket.on('review-notification', (notification) => {
  /*
  notification = {
    _id: "68eabcdef1234567890abcde",
    userId: "68e1234567890abcdef12345",
    type: "REVIEW_RECEIVED",
    title: "New Review",
    message: "John Doe left a 5-star review for Green Valley Field",
    data: {
      reviewId: "68eabcdef1234567890abcde",
      fieldId: "68e1234567890abcdef12345",
      rating: 5,
      reviewerName: "John Doe"
    },
    read: false,
    createdAt: "2025-10-07T10:45:00.000Z"
  }
  */

  showNotification(notification.title, notification.message);

  // If high rating, celebrate!
  if (notification.data.rating >= 4) {
    showCelebrationAnimation();
  }
});
```

### System Notifications

```typescript
socket.on('system-notification', (notification) => {
  /*
  notification = {
    _id: "68eabcdef1234567890abcde",
    userId: "ALL", // Broadcast to all users
    type: "SYSTEM_ANNOUNCEMENT",
    title: "Platform Maintenance",
    message: "Scheduled maintenance on Oct 10, 2025 from 2 AM to 4 AM",
    data: {
      priority: "HIGH",
      actionUrl: "/maintenance-info",
      actionText: "Learn More"
    },
    read: false,
    createdAt: "2025-10-07T11:00:00.000Z"
  }
  */

  // Show based on priority
  if (notification.data.priority === 'HIGH') {
    // Show modal that user must dismiss
    showModalNotification(notification);
  } else {
    // Show normal notification
    showNotification(notification.title, notification.message);
  }
});
```

---

## 🔄 Reconnection Handling

### Detecting Disconnection

```typescript
socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
  /*
  reason can be:
  - "io server disconnect" - Server kicked you out
  - "io client disconnect" - You called socket.disconnect()
  - "ping timeout" - Network issue
  - "transport close" - Network issue
  - "transport error" - Network issue
  */

  // Show offline indicator
  showOfflineIndicator();

  // If server disconnected, reconnect manually
  if (reason === 'io server disconnect') {
    socket.connect();
  }
  // Otherwise, socket will auto-reconnect
});
```

### Reconnection Attempts

```typescript
socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`🔄 Reconnecting... Attempt ${attemptNumber}`);

  // Show reconnecting indicator
  showReconnectingIndicator(attemptNumber);
});
```

### Successful Reconnection

```typescript
socket.on('reconnect', (attemptNumber) => {
  console.log(`✅ Reconnected after ${attemptNumber} attempts`);

  // Hide offline indicator
  hideOfflineIndicator();

  // Re-authenticate (required!)
  socket.emit('authenticate', {
    token: await AsyncStorage.getItem('authToken')
  });

  // Re-join current conversation if in chat
  if (currentConversationId) {
    socket.emit('join-conversation', {
      conversationId: currentConversationId
    });
  }

  // Refresh data
  refreshCurrentScreen();
});
```

### Failed Reconnection

```typescript
socket.on('reconnect_failed', () => {
  console.error('❌ Reconnection failed after all attempts');

  // Show error message
  showError('Unable to connect. Please check your internet connection.');

  // Show manual retry button
  showManualRetryButton();
});
```

---

## 🎯 Complete Mobile Implementation Example

### Socket Service Class

```typescript
// services/SocketService.ts
import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';

class SocketService extends EventEmitter {
  private socket: Socket | null = null;
  private authenticated = false;
  private currentConversationId: string | null = null;

  // Initialize socket connection
  connect() {
    if (this.socket?.connected) {
      console.log('Already connected');
      return;
    }

    const serverUrl = __DEV__
      ? 'http://localhost:5000'
      : 'https://fieldsy-api.indiitserver.in';

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupEventListeners();
  }

  // Setup all event listeners
  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', this.onConnect);
    this.socket.on('disconnect', this.onDisconnect);
    this.socket.on('authenticated', this.onAuthenticated);
    this.socket.on('authentication_error', this.onAuthError);

    // Chat events
    this.socket.on('conversation-joined', this.onConversationJoined);
    this.socket.on('new-message', this.onNewMessage);
    this.socket.on('message-sent', this.onMessageSent);
    this.socket.on('message-error', this.onMessageError);
    this.socket.on('typing', this.onTyping);
    this.socket.on('stop-typing', this.onStopTyping);
    this.socket.on('messages-read', this.onMessagesRead);

    // Notification events
    this.socket.on('notification', this.onNotification);
    this.socket.on('booking-notification', this.onBookingNotification);
    this.socket.on('payment-notification', this.onPaymentNotification);
    this.socket.on('review-notification', this.onReviewNotification);

    // Reconnection events
    this.socket.on('reconnect_attempt', this.onReconnectAttempt);
    this.socket.on('reconnect', this.onReconnect);
    this.socket.on('reconnect_failed', this.onReconnectFailed);
  }

  // Connection handlers
  private onConnect = async () => {
    console.log('✅ Socket connected');
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      this.socket?.emit('authenticate', { token });
    }
  };

  private onDisconnect = (reason: string) => {
    console.log('❌ Socket disconnected:', reason);
    this.authenticated = false;
    this.emit('disconnected', reason);
  };

  private onAuthenticated = (data: any) => {
    console.log('✅ Authenticated:', data.userId);
    this.authenticated = true;
    this.emit('authenticated', data);
  };

  private onAuthError = (error: any) => {
    console.error('❌ Authentication error:', error);
    this.emit('authError', error);
  };

  // Chat handlers
  private onConversationJoined = (data: any) => {
    console.log('Joined conversation:', data.conversationId);
    this.currentConversationId = data.conversationId;
    this.emit('conversationJoined', data);
  };

  private onNewMessage = (message: any) => {
    console.log('📩 New message:', message);
    this.emit('newMessage', message);
  };

  private onMessageSent = (data: any) => {
    console.log('✅ Message sent:', data);
    this.emit('messageSent', data);
  };

  private onMessageError = (error: any) => {
    console.error('❌ Message error:', error);
    this.emit('messageError', error);
  };

  private onTyping = (data: any) => {
    this.emit('typing', data);
  };

  private onStopTyping = (data: any) => {
    this.emit('stopTyping', data);
  };

  private onMessagesRead = (data: any) => {
    this.emit('messagesRead', data);
  };

  // Notification handlers
  private onNotification = (notification: any) => {
    console.log('🔔 Notification:', notification);
    this.emit('notification', notification);
  };

  private onBookingNotification = (notification: any) => {
    this.emit('bookingNotification', notification);
  };

  private onPaymentNotification = (notification: any) => {
    this.emit('paymentNotification', notification);
  };

  private onReviewNotification = (notification: any) => {
    this.emit('reviewNotification', notification);
  };

  // Reconnection handlers
  private onReconnectAttempt = (attempt: number) => {
    console.log(`🔄 Reconnect attempt ${attempt}`);
    this.emit('reconnecting', attempt);
  };

  private onReconnect = async (attempt: number) => {
    console.log(`✅ Reconnected after ${attempt} attempts`);

    // Re-authenticate
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      this.socket?.emit('authenticate', { token });
    }

    // Re-join conversation if active
    if (this.currentConversationId) {
      this.joinConversation(this.currentConversationId);
    }

    this.emit('reconnected', attempt);
  };

  private onReconnectFailed = () => {
    console.error('❌ Reconnection failed');
    this.emit('reconnectFailed');
  };

  // Public methods - Chat
  joinConversation(conversationId: string) {
    if (!this.authenticated) {
      console.warn('Not authenticated. Cannot join conversation.');
      return;
    }
    this.socket?.emit('join-conversation', { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('leave-conversation', { conversationId });
    this.currentConversationId = null;
  }

  sendMessage(conversationId: string, text: string, receiverId: string) {
    if (!this.authenticated) {
      console.warn('Not authenticated. Cannot send message.');
      return;
    }
    this.socket?.emit('send-message', {
      conversationId,
      text,
      receiverId
    });
  }

  startTyping(conversationId: string, userId: string) {
    this.socket?.emit('typing', { conversationId, userId });
  }

  stopTyping(conversationId: string, userId: string) {
    this.socket?.emit('stop-typing', { conversationId, userId });
  }

  markMessagesRead(conversationId: string, userId: string) {
    this.socket?.emit('mark-messages-read', { conversationId, userId });
  }

  // Disconnect
  disconnect() {
    this.socket?.disconnect();
    this.authenticated = false;
    this.currentConversationId = null;
  }

  // Getters
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }
}

export default new SocketService();
```

### React Context Provider

```typescript
// contexts/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import SocketService from '../services/SocketService';
import { useAuth } from './AuthContext';

interface SocketContextType {
  isConnected: boolean;
  isAuthenticated: boolean;
  sendMessage: (conversationId: string, text: string, receiverId: string) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (user && token) {
      // Connect when user is logged in
      SocketService.connect();

      // Setup listeners
      SocketService.on('authenticated', () => setIsAuthenticated(true));
      SocketService.on('disconnected', () => {
        setIsConnected(false);
        setIsAuthenticated(false);
      });
      SocketService.on('reconnected', () => setIsConnected(true));

      setIsConnected(true);
    } else {
      // Disconnect when user logs out
      SocketService.disconnect();
      setIsConnected(false);
      setIsAuthenticated(false);
    }

    return () => {
      // Cleanup
      SocketService.removeAllListeners();
    };
  }, [user, token]);

  const value = {
    isConnected,
    isAuthenticated,
    sendMessage: SocketService.sendMessage.bind(SocketService),
    joinConversation: SocketService.joinConversation.bind(SocketService),
    leaveConversation: SocketService.leaveConversation.bind(SocketService),
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
```

### Chat Screen Example

```typescript
// screens/ChatScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';
import SocketService from '../services/SocketService';
import { useSocket } from '../contexts/SocketContext';

interface Message {
  _id: string;
  text: string;
  senderId: string;
  createdAt: string;
}

export default function ChatScreen({ route }: any) {
  const { conversationId, otherUserId } = route.params;
  const { isAuthenticated } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Join conversation
    SocketService.joinConversation(conversationId);

    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      if (message.conversationId === conversationId) {
        setMessages(prev => [...prev, message]);

        // Mark as read
        SocketService.markMessagesRead(conversationId, myUserId);
      }
    };

    // Listen for typing
    const handleTyping = (data: any) => {
      if (data.conversationId === conversationId && data.userId !== myUserId) {
        setIsTyping(true);
      }
    };

    const handleStopTyping = (data: any) => {
      if (data.conversationId === conversationId) {
        setIsTyping(false);
      }
    };

    SocketService.on('newMessage', handleNewMessage);
    SocketService.on('typing', handleTyping);
    SocketService.on('stopTyping', handleStopTyping);

    // Cleanup
    return () => {
      SocketService.leaveConversation(conversationId);
      SocketService.off('newMessage', handleNewMessage);
      SocketService.off('typing', handleTyping);
      SocketService.off('stopTyping', handleStopTyping);
    };
  }, [conversationId, isAuthenticated]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    SocketService.sendMessage(conversationId, inputText, otherUserId);
    setInputText('');
  };

  const handleTextChange = (text: string) => {
    setInputText(text);

    // Send typing indicator
    if (text.length > 0) {
      SocketService.startTyping(conversationId, myUserId);

      // Auto-stop after 3 seconds
      setTimeout(() => {
        SocketService.stopTyping(conversationId, myUserId);
      }, 3000);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <View style={{ padding: 10 }}>
            <Text>{item.text}</Text>
          </View>
        )}
        keyExtractor={item => item._id}
      />

      {isTyping && <Text style={{ padding: 10 }}>Typing...</Text>}

      <View style={{ flexDirection: 'row', padding: 10 }}>
        <TextInput
          value={inputText}
          onChangeText={handleTextChange}
          placeholder="Type a message..."
          style={{ flex: 1, borderWidth: 1, padding: 10 }}
        />
        <TouchableOpacity onPress={handleSend}>
          <Text style={{ padding: 10 }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

---

## 📊 Event Summary Table

| Event Name | Type | When to Use | Required |
|------------|------|-------------|----------|
| `authenticate` | Emit | After connection | ✅ Yes |
| `authenticated` | Listen | Authentication success | ✅ Yes |
| `authentication_error` | Listen | Authentication failure | ✅ Yes |
| `join-conversation` | Emit | Open chat screen | ✅ Yes (chat) |
| `leave-conversation` | Emit | Close chat screen | ✅ Yes (chat) |
| `send-message` | Emit | Send message | ✅ Yes (chat) |
| `new-message` | Listen | Receive message | ✅ Yes (chat) |
| `message-sent` | Listen | Message confirmation | ✅ Yes (chat) |
| `typing` | Emit/Listen | Typing indicator | ⭕ Optional |
| `stop-typing` | Emit/Listen | Stop typing | ⭕ Optional |
| `mark-messages-read` | Emit | Mark as read | ⭕ Optional |
| `messages-read` | Listen | Read receipt | ⭕ Optional |
| `notification` | Listen | All notifications | ✅ Yes |
| `booking-notification` | Listen | Booking updates | ✅ Yes |
| `payment-notification` | Listen | Payment updates | ✅ Yes |
| `review-notification` | Listen | Review updates | ✅ Yes |
| `disconnect` | Listen | Handle disconnect | ✅ Yes |
| `reconnect` | Listen | Handle reconnect | ✅ Yes |

---

## ✅ Implementation Checklist

### Phase 1: Basic Setup
- [ ] Install `socket.io-client` package
- [ ] Create SocketService class
- [ ] Add connection on user login
- [ ] Add disconnection on user logout
- [ ] Implement authentication flow
- [ ] Test connection and authentication

### Phase 2: Chat Features
- [ ] Implement join conversation
- [ ] Implement send message
- [ ] Implement receive message
- [ ] Implement leave conversation
- [ ] Test message flow
- [ ] Add error handling

### Phase 3: Enhanced Chat
- [ ] Add typing indicators
- [ ] Add read receipts
- [ ] Add optimistic UI updates
- [ ] Test edge cases

### Phase 4: Notifications
- [ ] Listen for all notification types
- [ ] Show in-app notifications
- [ ] Integrate with push notifications
- [ ] Update notification badges
- [ ] Test notification flow

### Phase 5: Reliability
- [ ] Handle disconnection gracefully
- [ ] Implement reconnection logic
- [ ] Re-authenticate after reconnect
- [ ] Re-join conversations after reconnect
- [ ] Test network interruptions

### Phase 6: Polish
- [ ] Add loading states
- [ ] Add offline indicators
- [ ] Add sound effects
- [ ] Add haptic feedback
- [ ] Performance optimization

---

## 🐛 Troubleshooting

### Connection Issues

**Problem:** Socket not connecting

```typescript
// Check network
console.log('Network state:', NetInfo.getState());

// Check server URL
console.log('Connecting to:', SOCKET_URL);

// Check socket state
console.log('Socket connected:', SocketService.isConnected());
```

**Problem:** Authentication failing

```typescript
// Check token
const token = await AsyncStorage.getItem('authToken');
console.log('Token exists:', !!token);
console.log('Token:', token?.substring(0, 20) + '...');

// Verify token with REST API first
const response = await axios.get('/api/auth/verify', {
  headers: { Authorization: `Bearer ${token}` }
});
console.log('Token valid:', response.data);
```

### Message Issues

**Problem:** Messages not sending

```typescript
// Check authentication
console.log('Authenticated:', SocketService.isAuthenticated());

// Check conversation joined
console.log('Current conversation:', currentConversationId);

// Listen for errors
SocketService.on('message-error', (error) => {
  console.error('Message error:', error);
});
```

**Problem:** Messages not received

```typescript
// Check if listening
console.log('Listeners:', SocketService.eventNames());

// Check conversation ID matches
console.log('Expected conversation:', conversationId);
console.log('Message conversation:', message.conversationId);
```

### Notification Issues

**Problem:** Not receiving notifications

```typescript
// Check if authenticated
console.log('Authenticated:', SocketService.isAuthenticated());

// Check user ID
const token = await AsyncStorage.getItem('authToken');
const decoded = jwtDecode(token);
console.log('User ID:', decoded.userId);

// Listen for all events
SocketService.onAny((eventName, ...args) => {
  console.log('Event:', eventName, args);
});
```

---

## 🎓 Testing Guide

### Manual Testing Steps

1. **Connection Test**
   - Open app (logged out)
   - Socket should NOT connect
   - Log in
   - Socket should connect and authenticate
   - Check logs for "✅ Authenticated"

2. **Chat Test**
   - Open conversation
   - Send message "Test 1"
   - Check if message appears in UI
   - Open same conversation on another device
   - Check if message appears there
   - Reply from other device
   - Check if reply appears

3. **Typing Test**
   - Type in chat (don't send)
   - Check if "Typing..." appears on other device
   - Stop typing
   - Check if "Typing..." disappears

4. **Notification Test**
   - Create booking on web
   - Check if notification appears in app
   - Check if badge count increases
   - Check if push notification shows (if backgrounded)

5. **Reconnection Test**
   - Enable airplane mode
   - Check if offline indicator appears
   - Disable airplane mode
   - Check if reconnects automatically
   - Check if messages sent during offline are delivered

### Automated Testing

```typescript
// __tests__/SocketService.test.ts
import SocketService from '../services/SocketService';

describe('SocketService', () => {
  it('should connect', async () => {
    SocketService.connect();
    await new Promise(resolve => {
      SocketService.on('authenticated', resolve);
    });
    expect(SocketService.isConnected()).toBe(true);
    expect(SocketService.isAuthenticated()).toBe(true);
  });

  it('should send message', async () => {
    const testMessage = 'Test message';
    SocketService.sendMessage('conv123', testMessage, 'user123');

    await new Promise(resolve => {
      SocketService.on('messageSent', (data) => {
        expect(data.message.text).toBe(testMessage);
        resolve(true);
      });
    });
  });
});
```

---

## 📞 Support & Help

### Common Questions

**Q: Do I need to connect socket for every screen?**
A: No! Connect once when user logs in, disconnect when they log out.

**Q: What if user closes app while in chat?**
A: Socket will disconnect. Reconnect when app opens again.

**Q: Should I show notifications if user is in the chat screen?**
A: Show in-chat UI, not notification. Only show notification if user is on different screen.

**Q: How to test locally?**
A: Use `http://localhost:5000` for server URL. Make sure backend is running.

**Q: How to handle token expiry?**
A: Listen for `authentication_error`, refresh token, reconnect with new token.

### Getting Help

- Backend code: `/backend/src/utils/websocket.ts`
- Web example: `/frontend/src/contexts/SocketContext.tsx`
- Socket.IO docs: https://socket.io/docs/v4/client-api/

### Report Issues

If something doesn't work:
1. Check console logs
2. Check network tab (if using browser debugging)
3. Verify server is running
4. Verify authentication token is valid
5. Contact backend team with logs

---

## 🚀 You're Ready!

Follow this guide step by step, and you'll have fully functional real-time chat and notifications in your mobile app. Start with Phase 1 (Basic Setup) and work your way through each phase.

**Good luck! 🎉**
