const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFieldOwnership() {
  try {
    // Find the Rose field view
    const field = await prisma.field.findFirst({
      where: {
        name: { contains: 'Rose field view' }
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (field) {
      console.log('\n=== Field Information ===');
      console.log('Field ID:', field.id);
      console.log('Field Name:', field.name);
      console.log('Owner ID:', field.ownerId);
      console.log('Owner Name:', field.owner?.name);
      console.log('Owner Email:', field.owner?.email);
    } else {
      console.log('Field "Rose field view" not found');
    }
    
    // Check recent notifications
    console.log('\n=== Recent Notifications ===');
    const recentNotifications = await prisma.notification.findMany({
      where: {
        type: { in: ['new_review_received', 'review_posted_success'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
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
    
    recentNotifications.forEach((notif, index) => {
      console.log(`\n${index + 1}. ${notif.title}`);
      console.log('   Type:', notif.type);
      console.log('   Sent to User ID:', notif.userId);
      console.log('   User Name:', notif.user?.name);
      console.log('   User Email:', notif.user?.email);
      console.log('   Message:', notif.message);
      console.log('   Created:', notif.createdAt);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFieldOwnership();