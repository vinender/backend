import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export const initializeSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      
      console.log('WebSocket Auth - Decoded token:', {
        id: decoded.id,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      });
      
      // Get userId from token (it's stored as 'id' in the JWT)
      const userId = decoded.id || decoded.userId;
      
      if (!userId) {
        console.error('No userId found in token');
        return next(new Error('Invalid token - no user ID'));
      }
      
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true, email: true }
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      (socket as any).userEmail = user.email;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: AuthSocket) => {
    console.log('=== WebSocket Connection ===');
    console.log('User connected:');
    console.log('  - ID (ObjectId):', socket.userId);
    console.log('  - Email:', (socket as any).userEmail);
    console.log('  - Role:', socket.userRole);
    console.log('  - Socket ID:', socket.id);
    
    // Join user's personal room with proper format
    const userRoom = `user-${socket.userId}`;
    socket.join(userRoom);
    console.log(`  - Joined room: ${userRoom}`);
    
    // Log all rooms this socket is in
    console.log('  - Socket is in rooms:', Array.from(socket.rooms));
    
    // Check how many sockets are in the user's room
    const socketsInRoom = await io.in(userRoom).fetchSockets();
    console.log(`  - Total sockets in ${userRoom}: ${socketsInRoom.length}`);

    // Join conversation rooms
    socket.on('join-conversations', async () => {
      try {
        const conversations = await prisma.conversation.findMany({
          where: {
            participants: {
              has: socket.userId
            }
          },
          select: { id: true }
        });

        conversations.forEach(conv => {
          socket.join(`conversation:${conv.id}`);
        });
      } catch (error) {
        console.error('Error joining conversations:', error);
      }
    });

    // Handle joining a specific conversation
    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    // Handle leaving a conversation
    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit('user-typing', {
        userId: socket.userId,
        isTyping
      });
    });

    // Handle message read
    socket.on('mark-as-read', async ({ messageIds }) => {
      try {
        await prisma.message.updateMany({
          where: {
            id: { in: messageIds },
            receiverId: socket.userId
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        // Notify sender that message was read
        const messages = await prisma.message.findMany({
          where: { id: { in: messageIds } },
          select: { senderId: true, conversationId: true }
        });

        messages.forEach(msg => {
          io.to(`user-${msg.senderId}`).emit('message-read', {
            messageIds,
            conversationId: msg.conversationId
          });
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });

  return io;
};