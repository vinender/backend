//@ts-nocheck
import { PrismaClient } from '@prisma/client';

// Create a single instance of PrismaClient
const prismaClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Handle connection events
prismaClient.$connect()
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection failed:', error);
    console.log('📌 Make sure MongoDB is running:');
    console.log('   - For local MongoDB: mongod or brew services start mongodb-community');
    console.log('   - For MongoDB Atlas: Check your connection string and network access');
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prismaClient.$disconnect();
});

// Export both default and named export for better compatibility
export const prisma = prismaClient;
export default prismaClient;
