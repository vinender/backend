const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function setupTestUser() {
  try {
    console.log('🔧 Setting up test user...\n');
    
    // Find or create the test user
    let user = await prisma.user.findFirst({
      where: {
        email: 'vinendersingh91@gmail.com'
      }
    });
    
    const hashedPassword = await bcrypt.hash('12345678', 10);
    
    if (user) {
      // Update existing user's password
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          emailVerified: new Date()
        }
      });
      console.log('✅ Updated existing user password');
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: 'vinendersingh91@gmail.com',
          password: hashedPassword,
          name: 'Test Dog Owner',
          role: 'DOG_OWNER',
          emailVerified: new Date(),
          phone: '+1234567890'
        }
      });
      console.log('✅ Created new test user');
    }
    
    console.log('\n📧 Test User Credentials:');
    console.log('  Email: vinendersingh91@gmail.com');
    console.log('  Password: 12345678');
    console.log('  Role:', user.role);
    
  } catch (error) {
    console.error('❌ Error setting up test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestUser();