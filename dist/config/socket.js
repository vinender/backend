"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const initializeSocket = (server) => {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3001',
            credentials: true,
        },
    });
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
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
            socket.userEmail = user.email;
            next();
        }
        catch (error) {
            next(new Error('Invalid token'));
        }
    });
    // Connection handler
    io.on('connection', async (socket) => {
        console.log('=== WebSocket Connection ===');
        console.log('User connected:');
        console.log('  - ID (ObjectId):', socket.userId);
        console.log('  - Email:', socket.userEmail);
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
            }
            catch (error) {
                console.error('Error joining conversations:', error);
            }
        });
        // Handle joining a specific conversation
        socket.on('join-conversation', (conversationId) => {
            socket.join(`conversation:${conversationId}`);
        });
        // Handle leaving a conversation
        socket.on('leave-conversation', (conversationId) => {
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
            }
            catch (error) {
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
exports.initializeSocket = initializeSocket;
