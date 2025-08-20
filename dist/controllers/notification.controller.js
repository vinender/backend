"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = void 0;
exports.createNotification = createNotification;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.notificationController = {
    // Get all notifications for a user
    async getUserNotifications(req, res) {
        try {
            const userId = req.userId;
            const { page = 1, limit = 20, unreadOnly = false } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const where = { userId };
            if (unreadOnly === 'true') {
                where.read = false;
            }
            const [notifications, total, unreadCount] = await Promise.all([
                prisma.notification.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: Number(limit),
                }),
                prisma.notification.count({ where }),
                prisma.notification.count({ where: { userId, read: false } }),
            ]);
            res.json({
                success: true,
                data: {
                    notifications,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        totalPages: Math.ceil(total / Number(limit)),
                    },
                    unreadCount,
                },
            });
        }
        catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch notifications',
            });
        }
    },
    // Mark notification as read
    async markAsRead(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const notification = await prisma.notification.findFirst({
                where: { id, userId },
            });
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found',
                });
            }
            const updated = await prisma.notification.update({
                where: { id },
                data: {
                    read: true,
                    readAt: new Date(),
                },
            });
            res.json({
                success: true,
                data: updated,
            });
        }
        catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark notification as read',
            });
        }
    },
    // Mark all notifications as read
    async markAllAsRead(req, res) {
        try {
            const userId = req.userId;
            await prisma.notification.updateMany({
                where: { userId, read: false },
                data: {
                    read: true,
                    readAt: new Date(),
                },
            });
            res.json({
                success: true,
                message: 'All notifications marked as read',
            });
        }
        catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark all notifications as read',
            });
        }
    },
    // Delete a notification
    async deleteNotification(req, res) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const notification = await prisma.notification.findFirst({
                where: { id, userId },
            });
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found',
                });
            }
            await prisma.notification.delete({
                where: { id },
            });
            res.json({
                success: true,
                message: 'Notification deleted',
            });
        }
        catch (error) {
            console.error('Error deleting notification:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete notification',
            });
        }
    },
    // Clear all notifications
    async clearAllNotifications(req, res) {
        try {
            const userId = req.userId;
            await prisma.notification.deleteMany({
                where: { userId },
            });
            res.json({
                success: true,
                message: 'All notifications cleared',
            });
        }
        catch (error) {
            console.error('Error clearing notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to clear notifications',
            });
        }
    },
};
// Notification creation helper (to be used in other controllers)
async function createNotification({ userId, type, title, message, data, }) {
    try {
        console.log('Creating notification for user:', userId, { type, title, message });
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                data,
            },
        });
        console.log('Notification created successfully:', notification);
        // Emit real-time notification if WebSocket is connected
        const io = global.io;
        if (io) {
            console.log('Emitting real-time notification to user:', userId);
            io.to(`user-${userId}`).emit('notification', notification);
        }
        else {
            console.log('WebSocket not available, notification saved to DB only');
        }
        return notification;
    }
    catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}
