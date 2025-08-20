"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function setupWebSocket(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true,
        },
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
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
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
    io.on('connection', (socket) => {
        const userId = socket.userId;
        const userRole = socket.userRole;
        console.log(`User ${userId} connected (role: ${userRole})`);
        // Join user-specific room
        socket.join(`user-${userId}`);
        // Join role-specific room
        socket.join(`role-${userRole}`);
        // Send initial unread count
        sendUnreadCount(userId);
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
