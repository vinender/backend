//@ts-nocheck
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupWebSocket(server: HTTPServer) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
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

    console.log('=== WebSocket Connection (websocket.ts) ===');
    console.log(`User connected:`);
    console.log(`  - ID (ObjectId): ${userId}`);
    console.log(`  - Email: ${userEmail}`);
    console.log(`  - Role: ${userRole}`);
    console.log(`  - Socket ID: ${socket.id}`);

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
    console.log(`  - Joined room: ${userRoom}`);

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
        console.log(`  - Auto-joined conversation: ${convRoom}`);
      });

      console.log(`  - Total conversations joined: ${conversations.length}`);
    } catch (error) {
      console.error('Error auto-joining conversations:', error);
    }

    // Verify room membership
    const roomsAfterJoin = Array.from(socket.rooms);
    console.log(`  - Socket is in rooms:`, roomsAfterJoin);

    // Check how many sockets are in this user's room
    const socketsInRoom = await io.in(userRoom).fetchSockets();
    console.log(`  - Total sockets in ${userRoom}: ${socketsInRoom.length}`);

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

        // Fetch and send message history
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
          orderBy: { createdAt: 'asc' },
          take: 50
        });

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

    // Send a message via socket
    socket.on('send-message', async (data: { conversationId: string; content: string; receiverId: string }) => {
      try {
        const { conversationId, content, receiverId } = data;

        if (!conversationId || !content || !receiverId) {
          socket.emit('message-error', { error: 'Missing required fields' });
          return;
        }

        console.log(`[Socket] User ${userId} sending message to conversation ${conversationId}`);

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
          socket.emit('message-error', { error: 'Access denied' });
          return;
        }

        // Check if users have blocked each other
        const [senderBlockedReceiver, receiverBlockedSender] = await Promise.all([
          prisma.userBlock.findUnique({
            where: {
              blockerId_blockedUserId: {
                blockerId: userId,
                blockedUserId: receiverId
              }
            }
          }),
          prisma.userBlock.findUnique({
            where: {
              blockerId_blockedUserId: {
                blockerId: receiverId,
                blockedUserId: userId
              }
            }
          })
        ]);

        if (senderBlockedReceiver || receiverBlockedSender) {
          socket.emit('message-error', {
            error: 'Cannot send messages. One or both users have blocked each other.',
            blocked: true
          });
          return;
        }

        // Save message to DB
        const savedMessage = await prisma.message.create({
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
        });

        // Update conversation's last message
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessage: content,
            lastMessageAt: new Date()
          }
        });

        console.log(`[Socket] Message saved: ${savedMessage.id}`);

        // Broadcast to conversation room (all participants)
        const convRoom = `conversation:${conversationId}`;
        io.to(convRoom).emit('new-message', savedMessage);

        // Also send to receiver's user room for notification
        const receiverRoom = `user-${receiverId}`;
        io.to(receiverRoom).emit('new-message-notification', {
          conversationId,
          message: savedMessage
        });

        console.log(`[Socket] Message broadcasted to ${convRoom} and ${receiverRoom}`);

        // Send confirmation to sender
        socket.emit('message-sent', savedMessage);

      } catch (error) {
        console.error('[Socket] Error sending message:', error);
        socket.emit('message-error', { error: 'Failed to send message' });
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
      console.log(`User ${userId} disconnected`);
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
