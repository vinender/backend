"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
//@ts-nocheck
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class NotificationService {
    /**
     * Create notification for user and optionally for admin
     */
    static async createNotification(notificationData, notifyAdmin = true) {
        try {
            // Create notification for the user
            const userNotification = await prisma.notification.create({
                data: {
                    userId: notificationData.userId,
                    type: notificationData.type,
                    title: notificationData.title,
                    message: notificationData.message,
                    data: notificationData.data || {}
                }
            });
            // If notifyAdmin is true and it's an important notification type, also notify admin
            if (notifyAdmin && this.shouldNotifyAdmin(notificationData.type)) {
                // Get admin users
                const adminUsers = await prisma.user.findMany({
                    where: { role: 'ADMIN' },
                    select: { id: true }
                });
                // Create notification for each admin
                for (const admin of adminUsers) {
                    await prisma.notification.create({
                        data: {
                            userId: admin.id,
                            type: notificationData.type,
                            title: `[Admin Alert] ${notificationData.title}`,
                            message: notificationData.message,
                            data: {
                                ...notificationData.data,
                                originalUserId: notificationData.userId,
                                isAdminNotification: true
                            }
                        }
                    });
                }
            }
            return userNotification;
        }
        catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }
    /**
     * Determine if admin should be notified for this type
     */
    static shouldNotifyAdmin(type) {
        const adminNotificationTypes = [
            'booking_received',
            'booking_cancelled',
            'payment_received',
            'payment_failed',
            'field_added',
            'user_registered',
            'review_posted',
            'refund_processed',
            'payout_failed',
            'field_approved'
        ];
        return adminNotificationTypes.includes(type);
    }
    /**
     * Create bulk notifications
     */
    static async createBulkNotifications(notifications) {
        try {
            const results = [];
            for (const notification of notifications) {
                const result = await this.createNotification(notification);
                results.push(result);
            }
            return results;
        }
        catch (error) {
            console.error('Error creating bulk notifications:', error);
            throw error;
        }
    }
    /**
     * Notify all admins
     */
    static async notifyAdmins(title, message, data) {
        try {
            const adminUsers = await prisma.user.findMany({
                where: { role: 'ADMIN' },
                select: { id: true }
            });
            const notifications = [];
            for (const admin of adminUsers) {
                const notification = await prisma.notification.create({
                    data: {
                        userId: admin.id,
                        type: 'admin_alert',
                        title,
                        message,
                        data: data || {}
                    }
                });
                notifications.push(notification);
            }
            return notifications;
        }
        catch (error) {
            console.error('Error notifying admins:', error);
            throw error;
        }
    }
    /**
     * Get unread count for user
     */
    static async getUnreadCount(userId) {
        try {
            return await prisma.notification.count({
                where: {
                    userId,
                    read: false
                }
            });
        }
        catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }
}
exports.NotificationService = NotificationService;
