"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
//@ts-nocheck
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function setupWebSocket(server) {
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
    const io = new socket_io_1.Server(server, {
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
                }
                else {
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
    global.io = io;
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
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
            socket.userId = user.id;
            socket.userRole = user.role;
            socket.user = user;
            next();
        }
        catch (error) {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', async (socket) => {
        const userId = socket.userId;
        const userRole = socket.userRole;
        const userEmail = socket.user?.email;
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
        }
        catch (error) {
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
        socket.on('join-conversation', async (data) => {
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
                    orderBy: { createdAt: 'desc' }, // Get newest first
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
            }
            catch (error) {
                console.error('[Socket] Error joining conversation:', error);
                socket.emit('conversation-error', { error: 'Failed to join conversation' });
            }
        });
        // Fetch messages for a conversation (pagination support)
        socket.on('fetch-messages', async (data) => {
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
            }
            catch (error) {
                console.error('[Socket] Error fetching messages:', error);
                socket.emit('messages-error', { error: 'Failed to fetch messages' });
            }
        });
        // Send a message via socket (with acknowledgment callback)
        socket.on('send-message', async (data, callback) => {
            console.log(`[Socket] === SEND-MESSAGE EVENT RECEIVED ===`);
            console.log(`[Socket] From user: ${userId}`);
            console.log(`[Socket] Data:`, data);
            console.log(`[Socket] Has callback:`, !!callback);
            try {
                const { conversationId, content, receiverId, correlationId } = data;
                if (!conversationId || !content || !receiverId) {
                    console.log(`[Socket] Missing required fields, sending error`);
                    const error = { error: 'Missing required fields', correlationId };
                    socket.emit('message-error', error);
                    if (callback)
                        callback({ success: false, error: 'Missing required fields' });
                    return;
                }
                console.log(`[Socket] User ${userId} sending message to conversation ${conversationId}`);
                // Check what rooms this socket is currently in
                const socketRooms = Array.from(socket.rooms);
                console.log(`[Socket] Current socket rooms:`, socketRooms);
                const convRoom = `conversation:${conversationId}`;
                const isInConvRoom = socketRooms.includes(convRoom);
                console.log(`[Socket] Is socket in conversation room? ${isInConvRoom}`);
                // Make sure sender is in the conversation room to receive their own message
                if (!isInConvRoom) {
                    console.log(`[Socket] Adding sender to conversation room: ${convRoom}`);
                    socket.join(convRoom);
                }
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
                    const error = { error: 'Access denied', correlationId };
                    socket.emit('message-error', error);
                    if (callback)
                        callback({ success: false, error: 'Access denied' });
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
                    const error = {
                        error: 'Cannot send messages. One or both users have blocked each other.',
                        blocked: true,
                        correlationId
                    };
                    socket.emit('message-error', error);
                    if (callback)
                        callback({ success: false, error: error.error, blocked: true });
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
                console.log(`[Socket] Message saved to database with ID: ${savedMessage.id}`);
                console.log(`[Socket] Message content: "${content.substring(0, 50)}..."`);
                // Broadcast to conversation room (all participants)
                // convRoom already defined above on line 353
                // Broadcast to conversation room (both sender and receiver if they're in the room)
                const socketsInConvRoom = await io.in(convRoom).fetchSockets();
                console.log(`[Socket] Broadcasting to ${convRoom} - ${socketsInConvRoom.length} sockets connected`);
                console.log(`[Socket] Message sender ID: ${userId}, Receiver ID: ${receiverId}`);
                if (socketsInConvRoom.length > 0) {
                    console.log(`[Socket] Socket IDs in conversation room: ${socketsInConvRoom.map(s => s.id).join(', ')}`);
                    console.log(`[Socket] User IDs in room:`, socketsInConvRoom.map((s) => s.userId));
                    // Emit to everyone in the conversation room
                    io.to(convRoom).emit('new-message', savedMessage);
                    console.log(`[Socket] Emitted 'new-message' to conversation room with message ID: ${savedMessage.id}`);
                }
                // If receiver is NOT in the conversation room, send notification to their user room
                const receiverRoom = `user-${receiverId}`;
                const receiverInConvRoom = socketsInConvRoom.some((s) => {
                    // FIX: userId is attached directly to socket, not in s.data
                    return s.userId === receiverId;
                });
                if (!receiverInConvRoom) {
                    // Receiver is not in the conversation (probably on different page)
                    // Send notification to their user room
                    const socketsInReceiverRoom = await io.in(receiverRoom).fetchSockets();
                    console.log(`[Socket] Receiver not in conv room, notifying ${receiverRoom} - ${socketsInReceiverRoom.length} sockets`);
                    if (socketsInReceiverRoom.length > 0) {
                        io.to(receiverRoom).emit('new-message-notification', {
                            conversationId,
                            message: savedMessage
                        });
                        console.log(`[Socket] Emitted 'new-message-notification' to receiver room`);
                    }
                }
                console.log(`[Socket] Message broadcasted successfully`);
                // Send acknowledgment to sender with the saved message
                if (callback) {
                    console.log(`[Socket] Sending ACK to sender for message ${savedMessage.id}`);
                    callback({
                        success: true,
                        message: savedMessage,
                        correlationId: data.correlationId
                    });
                }
            }
            catch (error) {
                console.error('[Socket] Error sending message:', error);
                const errorResponse = { error: 'Failed to send message', correlationId: data.correlationId };
                socket.emit('message-error', errorResponse);
                if (callback)
                    callback({ success: false, error: 'Failed to send message' });
            }
        });
        // Mark messages as read
        socket.on('mark-as-read', async (data) => {
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
            }
            catch (error) {
                console.error('[Socket] Error marking messages as read:', error);
            }
        });
        // Typing indicator
        socket.on('typing', async (data) => {
            try {
                const { conversationId, isTyping } = data;
                // Broadcast to conversation room (except sender)
                socket.to(`conversation:${conversationId}`).emit('user-typing', {
                    userId,
                    conversationId,
                    isTyping
                });
            }
            catch (error) {
                console.error('[Socket] Error handling typing:', error);
            }
        });
        // ============ END CHAT MESSAGING EVENTS ============
        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected`);
        });
        // Handle marking notifications as read
        socket.on('markAsRead', async (notificationId) => {
            try {
                await prisma.notification.update({
                    where: { id: notificationId },
                    data: { read: true, readAt: new Date() },
                });
                // Send updated unread count
                sendUnreadCount(userId);
            }
            catch (error) {
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
            }
            catch (error) {
                console.error('Error marking all notifications as read:', error);
            }
        });
    });
    // Helper function to send unread count
    async function sendUnreadCount(userId) {
        try {
            const unreadCount = await prisma.notification.count({
                where: { userId, read: false },
            });
            io.to(`user-${userId}`).emit('unreadCount', unreadCount);
        }
        catch (error) {
            console.error('Error sending unread count:', error);
        }
    }
    return io;
}
