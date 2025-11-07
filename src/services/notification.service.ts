//@ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

export class NotificationService {
  /**
   * Create notification for user and optionally for admin
   */
  static async createNotification(notificationData: NotificationData, notifyAdmin: boolean = true) {
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

      // Emit socket event for user notification
      const io = (global as any).io;
      if (io && userNotification) {
        const userRoomName = `user-${notificationData.userId}`;
        console.log('[NotificationService] Emitting user notification to room:', userRoomName);
        io.to(userRoomName).emit('notification', userNotification);
      }

      // If notifyAdmin is true and it's an important notification type, also notify admin
      if (notifyAdmin && this.shouldNotifyAdmin(notificationData.type)) {
        // Get admin users
        const adminUsers = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true }
        });

        console.log(`[NotificationService] Creating admin notifications for ${adminUsers.length} admin(s)`);

        // Create notification for each admin and emit socket event
        for (const admin of adminUsers) {
          const adminNotification = await prisma.notification.create({
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

          // Emit socket event for admin notification
          if (io) {
            const adminRoomName = `user-${admin.id}`;
            console.log('[NotificationService] Emitting admin notification to room:', adminRoomName);
            io.to(adminRoomName).emit('notification', adminNotification);
          }
        }
      }

      return userNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Determine if admin should be notified for this type
   */
  static shouldNotifyAdmin(type: string): boolean {
    const adminNotificationTypes = [
      'booking_received',
      'booking_cancelled',
      'payment_received',
      'payment_failed',
      'field_added',
      'field_submitted',
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
  static async createBulkNotifications(notifications: NotificationData[]) {
    try {
      const results = [];
      for (const notification of notifications) {
        const result = await this.createNotification(notification);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Notify all admins
   */
  static async notifyAdmins(title: string, message: string, data?: any) {
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
    } catch (error) {
      console.error('Error notifying admins:', error);
      throw error;
    }
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notification.count({
        where: {
          userId,
          read: false
        }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }
}
