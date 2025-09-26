const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    // Find all admin users
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    });

    if (admins.length === 0) {
      console.log('❌ No admin users found in database!');
      console.log('Run: npm run reset:all:force to create default admin user');
    } else {
      console.log('✅ Found', admins.length, 'admin user(s):\n');
      admins.forEach((admin, index) => {
        console.log(`Admin #${index + 1}:`);
        console.log('  ID:', admin.id);
        console.log('  Email:', admin.email);
        console.log('  Name:', admin.name);
        console.log('  Role:', admin.role);
        console.log('  Email Verified:', admin.emailVerified ? 'Yes' : 'No');
        console.log('  Created:', admin.createdAt);
        console.log('');
      });
      
      console.log('📝 Default credentials for admin@fieldsy.com:');
      console.log('  Email: admin@fieldsy.com');
      console.log('  Password: admin123');
    }

    // Check if specific email exists
    const testEmails = ['admin@gmail.com', 'admin@fieldsy.com'];
    console.log('\n🔍 Checking specific emails:');
    for (const email of testEmails) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { email: true, role: true }
      });
      if (user) {
        console.log(`  ✅ ${email} exists (Role: ${user.role})`);
      } else {
        console.log(`  ❌ ${email} does NOT exist`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();