//@ts-nocheck
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Socket debug logging flag - controlled by environment variable
const SOCKET_DEBUG = process.env.SOCKET_DEBUG_LOGGING === 'true';

// Debug logger - only logs if SOCKET_DEBUG is true
const socketLog = (...args: any[]) => {
  if (SOCKET_DEBUG) {
    console.log(...args);
  }
};

// Always log errors regardless of debug flag
const socketError = (...args: any[]) => {
  console.error(...args);
};

export function setupWebSocket(server: HTTPServer) {
  // Define allowed origins for WebSocket connections
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:8081',
    'https://fieldsy.indiitserver.in',
    'https://fieldsy-admin.indiitserver.in',
    'http://fieldsy.indiitserver.in',
    'http://fieldsy-admin.indiitserver.in',
  ];

  // Add FRONTEND_URL if it's defined and not already in the list
  if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  console.log('[WebSocket] Allowed origins:', allowedOrigins);

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or server-side requests)
        if (!origin) {
          return callback(null, true);
        }

        // In development, be more permissive
        if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
          return callback(null, true);
        }

        // Check if the origin is allowed
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.log('[WebSocket] Rejected origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    transports: ['polling', 'websocket'], // Polling first for better compatibility
    allowEIO3: true, // Allow different Socket.IO versions
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    upgradeTimeout: 30000, // 30 seconds for upgrade
    maxHttpBufferSize: 1e8, // 100 MB
    path: '/socket.io/', // Explicit path
  });

  // Store io instance globally for use in other modules
  (global as any).io = io;

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      console.log('WebSocket Auth - Decoded token:', { 
        id: decoded.id, 
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role 
      });
      
      // The token uses 'id' not 'userId'
      const userId = decoded.id || decoded.userId;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, email: true, name: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user to socket
      (socket as any).userId = user.id;
      (socket as any).userRole = user.role;
      (socket as any).user = user;

      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;
    const userEmail = (socket as any).user?.email;

    socketLog('=== WebSocket Connection (websocket.ts) ===');
    socketLog(`User connected:`);
    socketLog(`  - ID (ObjectId): ${userId}`);
    socketLog(`  - Email: ${userEmail}`);
    socketLog(`  - Role: ${userRole}`);
    socketLog(`  - Socket ID: ${socket.id}`);

    // Leave all rooms first (except the socket's own room)
    const rooms = Array.from(socket.rooms);
    for (const room of rooms) {
      if (room !== socket.id) {
        socket.leave(room);
      }
    }

    // Join user-specific room based on ObjectId
    const userRoom = `user-${userId}`;
    socket.join(userRoom);
    socketLog(`  - Joined room: ${userRoom}`);

    // Auto-join all conversation rooms for this user
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            has: userId
          }
        },
        select: { id: true }
      });

      conversations.forEach(conv => {
        const convRoom = `conversation:${conv.id}`;
        socket.join(convRoom);
        socketLog(`  - Auto-joined conversation: ${convRoom}`);
      });

      socketLog(`  - Total conversations joined: ${conversations.length}`);
    } catch (error) {
      socketError('Error auto-joining conversations:', error);
    }

    // Verify room membership
    if (SOCKET_DEBUG) {
      const roomsAfterJoin = Array.from(socket.rooms);
      socketLog(`  - Socket is in rooms:`, roomsAfterJoin);

      // Check how many sockets are in this user's room
      const socketsInRoom = await io.in(userRoom).fetchSockets();
      socketLog(`  - Total sockets in ${userRoom}: ${socketsInRoom.length}`);
    }

    // Send initial unread count
    sendUnreadCount(userId);

    // ============ CHAT MESSAGING SOCKET EVENTS ============

    // Join a specific conversation and fetch message history
    socket.on('join-conversation', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        console.log(`[Socket] User ${userId} joining conversation: ${conversationId}`);

        // Verify user is participant
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            participants: {
              has: userId
            }
          }
        });

        if (!conversation) {
          socket.emit('conversation-error', { error: 'Access denied' });
          return;
        }

        // Join conversation room
        const convRoom = `conversation:${conversationId}`;
        socket.join(convRoom);
        console.log(`[Socket] User ${userId} joined room: ${convRoom}`);

        // Verify room membership
        const socketsInRoom = await io.in(convRoom).fetchSockets();
        console.log(`[Socket] Room ${convRoom} now has ${socketsInRoom.length} members`);

        // Fetch and send message history (most recent 50 messages)
        const messages = await prisma.message.findMany({
          where: { conversationId },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true
              }
            },
            receiver: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },  // Get newest first
          take: 50
        });

        // Reverse to show oldest to newest
        messages.reverse();

        // Send message history to this specific socket
        socket.emit('message-history', {
          conversationId,
          messages,
          total: messages.length
        });

        console.log(`[Socket] Sent ${messages.length} messages to user ${userId}`);

        // Mark unread messages as read
        await prisma.message.updateMany({
          where: {
            conversationId,
            receiverId: userId,
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

      } catch (error) {
        console.error('[Socket] Error joining conversation:', error);
        socket.emit('conversation-error', { error: 'Failed to join conversation' });
      }
    });

    // Fetch messages for a conversation (pagination support)
    socket.on('fetch-messages', async (data: { conversationId: string; page?: number; limit?: number }) => {
      try {
        const { conversationId, page = 1, limit = 50 } = data;
        const skip = (page - 1) * limit;

        // Verify user is participant
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            participants: {
              has: userId
            }
          }
        });

        if (!conversation) {
          socket.emit('messages-error', { error: 'Access denied' });
          return;
        }

        // Get messages
        const messages = await prisma.message.findMany({
          where: { conversationId },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true
              }
            },
            receiver: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        });

        const total = await prisma.message.count({
          where: { conversationId }
        });

        // Send messages to this socket
        socket.emit('messages-fetched', {
          conversationId,
          messages: messages.reverse(),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });

        // Mark messages as read
        await prisma.message.updateMany({
          where: {
            conversationId,
            receiverId: userId,
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

      } catch (error) {
        console.error('[Socket] Error fetching messages:', error);
        socket.emit('messages-error', { error: 'Failed to fetch messages' });
      }
    });

    // Send a message via socket (with acknowledgment callback)
    socket.on('send-message', async (data: { conversationId: string; content: string; receiverId: string; correlationId?: string }, callback?: Function) => {
      socketLog(`[Socket] === SEND-MESSAGE EVENT RECEIVED ===`);
      socketLog(`[Socket] From user: ${userId}`);
      socketLog(`[Socket] Data:`, data);
      socketLog(`[Socket] Has callback:`, !!callback);

      try {
        const { conversationId, content, receiverId, correlationId } = data;

        // Quick validation
        if (!conversationId || !content || !receiverId) {
          socketLog(`[Socket] Missing required fields, sending error`);
          const error = { error: 'Missing required fields', correlationId };
          socket.emit('message-error', error);
          if (callback) callback({ success: false, error: 'Missing required fields' });
          return;
        }

        const convRoom = `conversation:${conversationId}`;
        socketLog(`[Socket] User ${userId} sending message to conversation ${conversationId}`);

        // Join conversation room if not already in it
        if (!socket.rooms.has(convRoom)) {
          socketLog(`[Socket] Adding sender to conversation room: ${convRoom}`);
          socket.join(convRoom);
        } else {
          socketLog(`[Socket] Sender already in conversation room: ${convRoom}`);
        }

        // Parallel database operations for speed
        const [conversation, senderBlockedReceiver, receiverBlockedSender] = await Promise.all([
          // Verify user is participant
          prisma.conversation.findFirst({
            where: {
              id: conversationId,
              participants: {
                has: userId
              }
            }
          }),
          // Check if sender blocked receiver
          prisma.userBlock.findUnique({
            where: {
              blockerId_blockedUserId: {
                blockerId: userId,
                blockedUserId: receiverId
              }
            }
          }),
          // Check if receiver blocked sender
          prisma.userBlock.findUnique({
            where: {
              blockerId_blockedUserId: {
                blockerId: receiverId,
                blockedUserId: userId
              }
            }
          })
        ]);

        // Validation checks
        if (!conversation) {
          socketLog(`[Socket] Access denied - user not participant in conversation`);
          const error = { error: 'Access denied', correlationId };
          socket.emit('message-error', error);
          if (callback) callback({ success: false, error: 'Access denied' });
          return;
        }

        if (senderBlockedReceiver || receiverBlockedSender) {
          socketLog(`[Socket] Cannot send - users have blocked each other`);
          const error = {
            error: 'Cannot send messages. One or both users have blocked each other.',
            blocked: true,
            correlationId
          };
          socket.emit('message-error', error);
          if (callback) callback({ success: false, error: error.error, blocked: true });
          return;
        }

        // Save message and update conversation in parallel
        const [savedMessage] = await Promise.all([
          prisma.message.create({
            data: {
              conversationId,
              senderId: userId,
              receiverId,
              content,
              createdAt: new Date()
            },
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  role: true
                }
              },
              receiver: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  role: true
                }
              }
            }
          }),
          prisma.conversation.update({
            where: { id: conversationId },
            data: {
              lastMessage: content,
              lastMessageAt: new Date()
            }
          })
        ]);

        socketLog(`[Socket] Message saved to database with ID: ${savedMessage.id}`);
        socketLog(`[Socket] Message content: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);

        // Broadcast to conversation room immediately (no need to fetch sockets first)
        io.to(convRoom).emit('new-message', savedMessage);
        socketLog(`[Socket] ✅ Broadcasted 'new-message' to conversation room: ${convRoom}`);

        // Send notification to receiver's user room (they might not be in conversation)
        // This is fast because we just emit, we don't need to check if anyone is listening
        const receiverRoom = `user-${receiverId}`;
        io.to(receiverRoom).emit('new-message-notification', {
          conversationId,
          message: savedMessage
        });
        socketLog(`[Socket] ✅ Sent 'new-message-notification' to receiver room: ${receiverRoom}`);

        // Send acknowledgment to sender immediately
        if (callback) {
          socketLog(`[Socket] Sending ACK to sender for message ${savedMessage.id}`);
          callback({
            success: true,
            message: savedMessage,
            correlationId: data.correlationId
          });
        }

        socketLog(`[Socket] Message flow completed successfully`);

      } catch (error) {
        socketError('[Socket] Error sending message:', error);
        const errorResponse = { error: 'Failed to send message', correlationId: data.correlationId };
        socket.emit('message-error', errorResponse);
        if (callback) callback({ success: false, error: 'Failed to send message' });
      }
    });

    // Mark messages as read
    socket.on('mark-as-read', async (data: { messageIds: string[] }) => {
      try {
        const { messageIds } = data;

        await prisma.message.updateMany({
          where: {
            id: { in: messageIds },
            receiverId: userId
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        console.log(`[Socket] Marked ${messageIds.length} messages as read for user ${userId}`);

      } catch (error) {
        console.error('[Socket] Error marking messages as read:', error);
      }
    });

    // Typing indicator
    socket.on('typing', async (data: { conversationId: string; isTyping: boolean }) => {
      try {
        const { conversationId, isTyping } = data;

        // Broadcast to conversation room (except sender)
        socket.to(`conversation:${conversationId}`).emit('user-typing', {
          userId,
          conversationId,
          isTyping
        });

      } catch (error) {
        console.error('[Socket] Error handling typing:', error);
      }
    });

    // ============ END CHAT MESSAGING EVENTS ============

    // Handle disconnect
    socket.on('disconnect', () => {
      socketLog(`User ${userId} disconnected`);
    });

    // Handle marking notifications as read
    socket.on('markAsRead', async (notificationId: string) => {
      try {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { read: true, readAt: new Date() },
        });

        // Send updated unread count
        sendUnreadCount(userId);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    });

    // Handle marking all as read
    socket.on('markAllAsRead', async () => {
      try {
        await prisma.notification.updateMany({
          where: { userId, read: false },
          data: { read: true, readAt: new Date() },
        });

        // Send updated unread count
        sendUnreadCount(userId);
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
      }
    });
  });

  // Helper function to send unread count
  async function sendUnreadCount(userId: string) {
    try {
      const unreadCount = await prisma.notification.count({
        where: { userId, read: false },
      });
      
      io.to(`user-${userId}`).emit('unreadCount', unreadCount);
    } catch (error) {
      console.error('Error sending unread count:', error);
    }
  }

  return io;
}
