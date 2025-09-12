const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        email: 'admin@fieldsy.com',
        role: 'ADMIN'
      }
    });

    if (existingAdmin) {
      console.log('Admin already exists:', existingAdmin.email);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@fieldsy.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
        emailVerified: new Date()
      }
    });

    console.log('Admin created successfully!');
    console.log('Email:', admin.email);
    console.log('Password: Admin123!');
    console.log('Role:', admin.role);
    
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();