"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get createNotification () {
        return createNotification;
    },
    get notificationController () {
        return notificationController;
    }
});
const _client = require("@prisma/client");
const prisma = new _client.PrismaClient();
const notificationController = {
    // Get all notifications for a user
    async getUserNotifications (req, res) {
        try {
            // Get userId from req.user (set by auth middleware) or req.userId
            const userId = req.user?.id;
            console.log('Getting notifications for user:', userId);
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }
            const { page = 1, limit = 20, unreadOnly = false } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const where = {
                userId
            };
            if (unreadOnly === 'true') {
                where.read = false;
            }
            const [notifications, total, unreadCount] = await Promise.all([
                prisma.notification.findMany({
                    where,
                    orderBy: {
                        createdAt: 'desc'
                    },
                    skip,
                    take: Number(limit)
                }),
                prisma.notification.count({
                    where
                }),
                prisma.notification.count({
                    where: {
                        userId,
                        read: false
                    }
                })
            ]);
            res.json({
                success: true,
                data: notifications,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit))
                },
                unreadCount
            });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch notifications'
            });
        }
    },
    // Mark notification as read
    async markAsRead (req, res) {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            const notification = await prisma.notification.findFirst({
                where: {
                    id,
                    userId
                }
            });
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found'
                });
            }
            const updated = await prisma.notification.update({
                where: {
                    id
                },
                data: {
                    read: true,
                    readAt: new Date()
                }
            });
            res.json({
                success: true,
                data: updated
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark notification as read'
            });
        }
    },
    // Mark all notifications as read
    async markAllAsRead (req, res) {
        try {
            const userId = req.user?.id;
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
            res.json({
                success: true,
                message: 'All notifications marked as read'
            });
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark all notifications as read'
            });
        }
    },
    // Delete a notification
    async deleteNotification (req, res) {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            const notification = await prisma.notification.findFirst({
                where: {
                    id,
                    userId
                }
            });
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification not found'
                });
            }
            await prisma.notification.delete({
                where: {
                    id
                }
            });
            res.json({
                success: true,
                message: 'Notification deleted'
            });
        } catch (error) {
            console.error('Error deleting notification:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete notification'
            });
        }
    },
    // Clear all notifications
    async clearAllNotifications (req, res) {
        try {
            const userId = req.user?.id;
            await prisma.notification.deleteMany({
                where: {
                    userId
                }
            });
            res.json({
                success: true,
                message: 'All notifications cleared'
            });
        } catch (error) {
            console.error('Error clearing notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to clear notifications'
            });
        }
    },
    // Get unread notification count
    async getUnreadCount (req, res) {
        try {
            const userId = req.user?.id;
            console.log('Getting unread count for user:', userId);
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }
            const unreadCount = await prisma.notification.count({
                where: {
                    userId,
                    read: false
                }
            });
            res.json({
                success: true,
                count: unreadCount
            });
        } catch (error) {
            console.error('Error fetching unread count:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch unread notification count'
            });
        }
    }
};
async function createNotification({ userId, type, title, message, data }) {
    try {
        console.log('=== Creating Notification ===');
        console.log('Target User ID (ObjectId):', userId);
        console.log('Notification Type:', type);
        console.log('Title:', title);
        // Validate userId is a valid ObjectId
        if (!userId || typeof userId !== 'string' || userId.length !== 24) {
            console.error('Invalid userId format:', userId);
            return null;
        }
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                data
            }
        });
        console.log('Notification created in DB with ID:', notification.id);
        console.log('Notification userId:', notification.userId);
        // Emit real-time notification if WebSocket is connected
        const io = global.io;
        if (io) {
            const roomName = `user-${userId}`; // Using user- format to match socket.ts
            console.log('Emitting notification to WebSocket room:', roomName);
            // Get all sockets in the room to verify
            const sockets = await io.in(roomName).fetchSockets();
            console.log(`Found ${sockets.length} socket(s) in room ${roomName}`);
            if (sockets.length > 0) {
                io.to(roomName).emit('notification', notification);
                console.log('Notification emitted successfully to room:', roomName);
            } else {
                console.log('No active sockets in room, user might be offline');
            }
        } else {
            console.log('WebSocket server not available, notification saved to DB only');
        }
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

//# sourceMappingURL=notification.controller.js.map