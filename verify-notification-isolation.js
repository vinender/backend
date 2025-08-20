const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyNotificationIsolation() {
  console.log('\n=== Verifying Notification User Isolation ===\n');
  
  try {
    // 1. Get distinct users with different roles
    const fieldOwner = await prisma.user.findFirst({
      where: { 
        email: 'chandel.vinender@gmail.com',
        role: 'FIELD_OWNER'
      },
      select: { id: true, name: true, email: true, role: true }
    });
    
    const dogOwner = await prisma.user.findFirst({
      where: { 
        email: 'vinendersingh91@gmail.com',
        role: 'DOG_OWNER'
      },
      select: { id: true, name: true, email: true, role: true }
    });
    
    console.log('Field Owner:', {
      id: fieldOwner?.id,
      name: fieldOwner?.name,
      email: fieldOwner?.email
    });
    
    console.log('\nDog Owner:', {
      id: dogOwner?.id,
      name: dogOwner?.name,
      email: dogOwner?.email
    });
    
    console.log('\nAre they the same user?', fieldOwner?.id === dogOwner?.id ? 'YES ❌' : 'NO ✅');
    
    // 2. Check recent notifications for each user
    console.log('\n=== Recent Notifications ===');
    
    if (fieldOwner) {
      const fieldOwnerNotifs = await prisma.notification.findMany({
        where: { userId: fieldOwner.id },
        orderBy: { createdAt: 'desc' },
        take: 3
      });
      
      console.log(`\nField Owner (${fieldOwner.email}) has ${fieldOwnerNotifs.length} notifications:`);
      fieldOwnerNotifs.forEach(n => {
        console.log(`  - [${n.type}] ${n.title}`);
        console.log(`    For userId: ${n.userId}`);
      });
    }
    
    if (dogOwner) {
      const dogOwnerNotifs = await prisma.notification.findMany({
        where: { userId: dogOwner.id },
        orderBy: { createdAt: 'desc' },
        take: 3
      });
      
      console.log(`\nDog Owner (${dogOwner.email}) has ${dogOwnerNotifs.length} notifications:`);
      dogOwnerNotifs.forEach(n => {
        console.log(`  - [${n.type}] ${n.title}`);
        console.log(`    For userId: ${n.userId}`);
      });
    }
    
    // 3. Check for cross-contamination
    console.log('\n=== Checking for Cross-Contamination ===');
    
    const allNotifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: { email: true, name: true }
        }
      }
    });
    
    const userNotifCounts = {};
    allNotifications.forEach(n => {
      const key = `${n.userId} (${n.user.email})`;
      userNotifCounts[key] = (userNotifCounts[key] || 0) + 1;
    });
    
    console.log('\nNotification distribution:');
    Object.entries(userNotifCounts).forEach(([user, count]) => {
      console.log(`  ${user}: ${count} notifications`);
    });
    
    // 4. Test creating notifications for specific users
    console.log('\n=== Testing Direct Notification Creation ===');
    
    if (fieldOwner && dogOwner) {
      // Clear test notifications first
      await prisma.notification.deleteMany({
        where: {
          type: 'isolation_test'
        }
      });
      
      // Create test notification for field owner only
      const fieldOwnerTestNotif = await prisma.notification.create({
        data: {
          userId: fieldOwner.id,
          type: 'isolation_test',
          title: 'Test for Field Owner Only',
          message: 'This should only appear for the field owner',
          data: { test: true }
        }
      });
      
      // Create test notification for dog owner only
      const dogOwnerTestNotif = await prisma.notification.create({
        data: {
          userId: dogOwner.id,
          type: 'isolation_test',
          title: 'Test for Dog Owner Only',
          message: 'This should only appear for the dog owner',
          data: { test: true }
        }
      });
      
      console.log('Created test notification for field owner:', fieldOwnerTestNotif.id);
      console.log('Created test notification for dog owner:', dogOwnerTestNotif.id);
      
      // Verify isolation
      const fieldOwnerHasWrongNotif = await prisma.notification.findFirst({
        where: {
          userId: fieldOwner.id,
          title: 'Test for Dog Owner Only'
        }
      });
      
      const dogOwnerHasWrongNotif = await prisma.notification.findFirst({
        where: {
          userId: dogOwner.id,
          title: 'Test for Field Owner Only'
        }
      });
      
      console.log('\nIsolation Test Results:');
      console.log('Field owner has dog owner notification?', fieldOwnerHasWrongNotif ? 'YES ❌' : 'NO ✅');
      console.log('Dog owner has field owner notification?', dogOwnerHasWrongNotif ? 'YES ❌' : 'NO ✅');
      
      // Clean up test notifications
      await prisma.notification.deleteMany({
        where: {
          type: 'isolation_test'
        }
      });
      console.log('\nCleaned up test notifications');
    }
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyNotificationIsolation();