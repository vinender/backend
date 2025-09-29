"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "setupWebSocket", {
    enumerable: true,
    get: function() {
        return setupWebSocket;
    }
});
const _socketio = require("socket.io");
const _jsonwebtoken = /*#__PURE__*/ _interop_require_default(require("jsonwebtoken"));
const _client = require("@prisma/client");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const prisma = new _client.PrismaClient();
function setupWebSocket(server) {
    const io = new _socketio.Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true
        }
    });
    // Store io instance globally for use in other modules
    global.io = io;
    // Authentication middleware
    io.use(async (socket, next)=>{
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error'));
            }
            const decoded = _jsonwebtoken.default.verify(token, process.env.JWT_SECRET);
            console.log('WebSocket Auth - Decoded token:', {
                id: decoded.id,
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role
            });
            // The token uses 'id' not 'userId'
            const userId = decoded.id || decoded.userId;
            const user = await prisma.user.findUnique({
                where: {
                    id: userId
                },
                select: {
                    id: true,
                    role: true,
                    email: true,
                    name: true
                }
            });
            if (!user) {
                return next(new Error('User not found'));
            }
            // Attach user to socket
            socket.userId = user.id;
            socket.userRole = user.role;
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', async (socket)=>{
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
        for (const room of rooms){
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
                select: {
                    id: true
                }
            });
            conversations.forEach((conv)=>{
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
        // Handle disconnect
        socket.on('disconnect', ()=>{
            console.log(`User ${userId} disconnected`);
        });
        // Handle marking notifications as read
        socket.on('markAsRead', async (notificationId)=>{
            try {
                await prisma.notification.update({
                    where: {
                        id: notificationId
                    },
                    data: {
                        read: true,
                        readAt: new Date()
                    }
                });
                // Send updated unread count
                sendUnreadCount(userId);
            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        });
        // Handle marking all as read
        socket.on('markAllAsRead', async ()=>{
            try {
                await prisma.notification.updateMany({
                    where: {
                        userId,
                        read: false
                    },
                    data: {
                        read: true,
                        readAt: new Date()
                    }
                });
                // Send updated unread count
                sendUnreadCount(userId);
            } catch (error) {
                console.error('Error marking all notifications as read:', error);
            }
        });
    });
    // Helper function to send unread count
    async function sendUnreadCount(userId) {
        try {
            const unreadCount = await prisma.notification.count({
                where: {
                    userId,
                    read: false
                }
            });
            io.to(`user-${userId}`).emit('unreadCount', unreadCount);
        } catch (error) {
            console.error('Error sending unread count:', error);
        }
    }
    return io;
}

//# sourceMappingURL=websocket.js.map