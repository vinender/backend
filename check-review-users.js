const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReviewUsers() {
  try {
    // Find the Rose field view
    const field = await prisma.field.findFirst({
      where: {
        name: { contains: 'Rose field view' }
      },
      select: {
        id: true,
        name: true,
        ownerId: true
      }
    });
    
    if (!field) {
      console.log('Field not found');
      return;
    }
    
    console.log('\n=== Field Info ===');
    console.log('Field:', field.name);
    console.log('Field ID:', field.id);
    console.log('Owner ID:', field.ownerId);
    
    // Get recent reviews for this field
    console.log('\n=== Recent Reviews ===');
    const reviews = await prisma.fieldReview.findMany({
      where: { fieldId: field.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
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
    
    reviews.forEach((review, index) => {
      console.log(`\n${index + 1}. Review by: ${review.user?.name || review.userName}`);
      console.log('   Reviewer ID:', review.userId);
      console.log('   Reviewer Email:', review.user?.email);
      console.log('   Rating:', review.rating, 'stars');
      console.log('   Is owner reviewing own field?', review.userId === field.ownerId);
      console.log('   Created:', review.createdAt);
    });
    
    // Check who's logged in with different emails
    console.log('\n=== User Accounts ===');
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: 'chandel.vinender@gmail.com' },
          { email: 'vinendersingh91@gmail.com' }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
    
    users.forEach(user => {
      console.log(`\n- ${user.name} (${user.email})`);
      console.log('  ID:', user.id);
      console.log('  Role:', user.role);
      console.log('  Is field owner?', user.id === field.ownerId);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReviewUsers();