import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

async function createAdmin() {
  try {
    console.log('\n🔐 Admin Creation Script\n');
    console.log('This script will create an admin user for the Fieldsy platform.\n');

    const email = await question('Enter admin email: ');
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Invalid email format');
      process.exit(1);
    }

    // Check if admin already exists using compound unique constraint
    const existingAdmin = await prisma.user.findUnique({
      where: { 
        email_role: {
          email,
          role: UserRole.ADMIN
        }
      }
    });

    if (existingAdmin) {
      console.error('❌ Admin with this email already exists');
      process.exit(1);
    }

    const password = await question('Enter admin password (min 8 characters): ');
    
    // Validate password
    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters long');
      process.exit(1);
    }

    const confirmPassword = await question('Confirm password: ');
    
    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    const name = await question('Enter admin name: ');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create or update user as admin
    const admin = await prisma.user.upsert({
      where: { 
        email_role: {
          email,
          role: UserRole.ADMIN
        }
      },
      update: {
        name,
        password: hashedPassword,
        emailVerified: new Date() // Set as verified with current date
      },
      create: {
        email,
        name,
        password: hashedPassword,
        role: UserRole.ADMIN,
        emailVerified: new Date() // Set as verified with current date
      }
    });

    console.log('\n✅ Admin created successfully!');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Role: ${admin.role}`);
    console.log('\nYou can now login to the admin dashboard at http://localhost:3003\n');

  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Run the script
createAdmin();