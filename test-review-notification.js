const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testReviewNotification() {
  try {
    console.log('\n=== Testing Review Notification Logic ===\n');
    
    // Get the field and users
    const field = await prisma.field.findFirst({
      where: { name: { contains: 'Rose field view' } },
      select: { id: true, name: true, ownerId: true }
    });
    
    const fieldOwner = await prisma.user.findUnique({
      where: { id: field.ownerId },
      select: { id: true, name: true, email: true }
    });
    
    const reviewer = await prisma.user.findFirst({
      where: { email: 'vinendersingh91@gmail.com' },
      select: { id: true, name: true, email: true }
    });
    
    console.log('Field:', field.name);
    console.log('Field Owner:', fieldOwner.name, `(${fieldOwner.email})`, 'ID:', fieldOwner.id);
    console.log('Reviewer:', reviewer.name, `(${reviewer.email})`, 'ID:', reviewer.id);
    console.log('\nAre they the same person?', fieldOwner.id === reviewer.id ? 'YES ❌' : 'NO ✓');
    
    // Clear existing test notifications
    console.log('\n=== Clearing Old Test Notifications ===');
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { userId: fieldOwner.id, type: { in: ['new_review_received', 'review_posted_success'] } },
          { userId: reviewer.id, type: { in: ['new_review_received', 'review_posted_success'] } }
        ]
      }
    });
    console.log('Cleared old notifications');
    
    // Simulate the notification creation logic from review controller
    console.log('\n=== Simulating Review Creation ===');
    
    // This is what should happen in the controller
    if (field.ownerId && field.ownerId !== reviewer.id) {
      console.log('✓ Creating "new review" notification for field owner:', fieldOwner.id);
      const ownerNotif = await prisma.notification.create({
        data: {
          userId: field.ownerId,
          type: 'new_review_received',
          title: "You've got a new review!",
          message: `See what a recent visitor had to say about their experience at ${field.name}.`,
          data: {
            fieldId: field.id,
            fieldName: field.name,
            rating: 4,
            reviewerName: reviewer.name
          }
        }
      });
      console.log('  Created notification ID:', ownerNotif.id);
    } else {
      console.log('✗ Skipping field owner notification (reviewer is the owner)');
    }
    
    console.log('✓ Creating "review posted" notification for reviewer:', reviewer.id);
    const reviewerNotif = await prisma.notification.create({
      data: {
        userId: reviewer.id,
        type: 'review_posted_success',
        title: 'Review Posted Successfully',
        message: `Your 4 star review for ${field.name} has been posted successfully.`,
        data: {
          fieldId: field.id,
          fieldName: field.name,
          rating: 4
        }
      }
    });
    console.log('  Created notification ID:', reviewerNotif.id);
    
    // Verify the notifications
    console.log('\n=== Verifying Notifications ===');
    
    const ownerNotifications = await prisma.notification.findMany({
      where: { userId: fieldOwner.id },
      orderBy: { createdAt: 'desc' },
      take: 2
    });
    
    const reviewerNotifications = await prisma.notification.findMany({
      where: { userId: reviewer.id },
      orderBy: { createdAt: 'desc' },
      take: 2
    });
    
    console.log(`\nField Owner (${fieldOwner.email}) has ${ownerNotifications.length} notification(s):`);
    ownerNotifications.forEach(n => {
      console.log(`  - [${n.type}] ${n.title}`);
    });
    
    console.log(`\nReviewer (${reviewer.email}) has ${reviewerNotifications.length} notification(s):`);
    reviewerNotifications.forEach(n => {
      console.log(`  - [${n.type}] ${n.title}`);
    });
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReviewNotification();