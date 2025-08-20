const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNotifications() {
  try {
    // Get the most recent review-related notifications
    console.log('\n=== Recent Review Notifications ===');
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { type: 'new_review_received' },
          { type: 'review_posted_success' },
          { type: 'review_posted' }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (notifications.length === 0) {
      console.log('No review notifications found');
    } else {
      notifications.forEach((notif, index) => {
        console.log(`\n${index + 1}. ${notif.title}`);
        console.log('   Type:', notif.type);
        console.log('   Notification ID:', notif.id);
        console.log('   Sent to User ID:', notif.userId);
        console.log('   User Name:', notif.user?.name);
        console.log('   User Email:', notif.user?.email);
        console.log('   Message:', notif.message);
        console.log('   Data:', JSON.stringify(notif.data, null, 2));
        console.log('   Created:', notif.createdAt);
        console.log('   Read:', notif.read);
      });
    }
    
    // Check for duplicate notifications
    console.log('\n=== Checking for Duplicates ===');
    const duplicateCheck = await prisma.notification.groupBy({
      by: ['userId', 'type', 'title'],
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      _count: {
        id: true
      },
      having: {
        id: {
          _count: {
            gt: 1
          }
        }
      }
    });
    
    if (duplicateCheck.length > 0) {
      console.log('Found duplicate notifications:');
      duplicateCheck.forEach(dup => {
        console.log(`- ${dup._count.id} notifications of type "${dup.type}" sent to user ${dup.userId}`);
      });
    } else {
      console.log('No duplicate notifications found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotifications();