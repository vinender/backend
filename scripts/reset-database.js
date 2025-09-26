#!/usr/bin/env node

/**
 * Quick database reset (without Stripe cleanup)
 * Use this for faster testing when Stripe accounts don't need to be deleted
 * 
 * Usage: node scripts/reset-database.js [--force]
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt user
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

async function resetDatabase() {
  const isForced = process.argv.includes('--force');
  
  console.log(`${colors.yellow}⚠️  DATABASE RESET WARNING${colors.reset}`);
  console.log(`This will delete all data from the database (Stripe accounts will remain)`);
  
  if (!isForced) {
    const answer = await askQuestion(`\nType 'RESET' to confirm: `);
    if (answer !== 'RESET') {
      console.log('Reset cancelled.');
      process.exit(0);
    }
  }
  
  try {
    console.log(`\n${colors.cyan}Starting database reset...${colors.reset}`);
    
    // Delete in dependency order
    await prisma.notification.deleteMany({});
    console.log(`${colors.green}✓ Cleared notifications${colors.reset}`);
    
    await prisma.message.deleteMany({});
    console.log(`${colors.green}✓ Cleared messages${colors.reset}`);
    
    await prisma.conversation.deleteMany({});
    console.log(`${colors.green}✓ Cleared conversations${colors.reset}`);
    
    await prisma.fieldReview.deleteMany({});
    console.log(`${colors.green}✓ Cleared field reviews${colors.reset}`);
    
    await prisma.payment.deleteMany({});
    console.log(`${colors.green}✓ Cleared payments${colors.reset}`);
    
    await prisma.booking.deleteMany({});
    console.log(`${colors.green}✓ Cleared bookings${colors.reset}`);
    
    
    await prisma.favorite.deleteMany({});
    console.log(`${colors.green}✓ Cleared favorites${colors.reset}`);
    
    await prisma.paymentMethod.deleteMany({});
    console.log(`${colors.green}✓ Cleared payment methods${colors.reset}`);
    
    await prisma.payout.deleteMany({});
    console.log(`${colors.green}✓ Cleared payouts${colors.reset}`);
    
    await prisma.stripeAccount.deleteMany({});
    console.log(`${colors.green}✓ Cleared Stripe account records${colors.reset}`);
    
    await prisma.fieldClaim.deleteMany({});
    console.log(`${colors.green}✓ Cleared field claims${colors.reset}`);
    
    await prisma.field.deleteMany({});
    console.log(`${colors.green}✓ Cleared fields${colors.reset}`);
    
    await prisma.userReport.deleteMany({});
    console.log(`${colors.green}✓ Cleared user reports${colors.reset}`);
    
    await prisma.userBlock.deleteMany({});
    console.log(`${colors.green}✓ Cleared user blocks${colors.reset}`);
    
    // Settings are preserved - not deleted:
    // - commission settings
    // - aboutPage content
    // - FAQs
    // - systemSettings
    console.log(`${colors.cyan}ℹ️  Settings data preserved (commission, about page, FAQs, system settings)${colors.reset}`);
    
    await prisma.user.deleteMany({});
    console.log(`${colors.green}✓ Cleared users${colors.reset}`);
    
    console.log(`\n${colors.green}✅ Database reset complete!${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}✗ Error: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

resetDatabase();