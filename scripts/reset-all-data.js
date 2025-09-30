#!/usr/bin/env node

/**
 * DANGER: This script will DELETE ALL DATA from the database and Stripe
 * Use only for development/testing purposes
 * 
 * Usage: node scripts/reset-all-data.js [--force]
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const prisma = new PrismaClient();

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Create readline interface for user input
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

// Function to delete all Stripe data
async function deleteStripeData() {
  try {
    console.log(`${colors.yellow}🔄 Starting complete Stripe cleanup...${colors.reset}`);
    
    let stats = {
      connectedAccounts: { deleted: 0, skipped: 0 },
      customers: { deleted: 0, skipped: 0 },
      paymentMethods: { deleted: 0, skipped: 0 }
    };
    
    // 1. Delete Stripe Connected Accounts
    console.log(`${colors.cyan}Fetching Stripe connected accounts...${colors.reset}`);
    const stripeAccounts = await prisma.stripeAccount.findMany();

    const validAccounts = stripeAccounts.filter(a => a.stripeAccountId);
    if (validAccounts.length > 0) {
      console.log(`${colors.yellow}Found ${validAccounts.length} connected accounts${colors.reset}`);
      for (const account of validAccounts) {
        try {
          if (account.stripeAccountId?.startsWith('acct_')) {
            await stripe.accounts.del(account.stripeAccountId);
            console.log(`${colors.green}  ✓ Deleted account: ${account.stripeAccountId}${colors.reset}`);
            stats.connectedAccounts.deleted++;
          } else {
            stats.connectedAccounts.skipped++;
          }
        } catch (error) {
          if (error.code === 'resource_missing') {
            console.log(`${colors.yellow}  ⚠ Already deleted: ${account.stripeAccountId}${colors.reset}`);
          }
          stats.connectedAccounts.skipped++;
        }
      }
    }
    
    // 2. Delete Stripe Customers
    console.log(`${colors.cyan}Fetching Stripe customers...${colors.reset}`);
    const users = await prisma.user.findMany();
    
    const usersWithStripe = users.filter(u => u.stripeCustomerId);
    if (usersWithStripe.length > 0) {
      console.log(`${colors.yellow}Found ${usersWithStripe.length} Stripe customers${colors.reset}`);
      for (const user of usersWithStripe) {
        try {
          if (user.stripeCustomerId?.startsWith('cus_')) {
            // First, delete all payment methods for this customer
            const paymentMethods = await stripe.paymentMethods.list({
              customer: user.stripeCustomerId,
              limit: 100
            });
            
            for (const pm of paymentMethods.data) {
              try {
                await stripe.paymentMethods.detach(pm.id);
                console.log(`${colors.green}    ✓ Detached payment method: ${pm.id}${colors.reset}`);
                stats.paymentMethods.deleted++;
              } catch (error) {
                stats.paymentMethods.skipped++;
              }
            }
            
            // Then delete the customer
            await stripe.customers.del(user.stripeCustomerId);
            console.log(`${colors.green}  ✓ Deleted customer: ${user.stripeCustomerId}${colors.reset}`);
            stats.customers.deleted++;
          } else {
            stats.customers.skipped++;
          }
        } catch (error) {
          if (error.code === 'resource_missing') {
            console.log(`${colors.yellow}  ⚠ Already deleted: ${user.stripeCustomerId}${colors.reset}`);
          }
          stats.customers.skipped++;
        }
      }
    }
    
    // 3. Delete orphaned payment methods
    console.log(`${colors.cyan}Checking for orphaned payment methods...${colors.reset}`);
    const paymentMethods = await prisma.paymentMethod.findMany();
    
    const methodsWithStripe = paymentMethods.filter(pm => pm.stripePaymentMethodId);
    if (methodsWithStripe.length > 0) {
      console.log(`${colors.yellow}Found ${methodsWithStripe.length} saved payment methods${colors.reset}`);
      for (const method of methodsWithStripe) {
        try {
          if (method.stripePaymentMethodId?.startsWith('pm_')) {
            await stripe.paymentMethods.detach(method.stripePaymentMethodId);
            console.log(`${colors.green}  ✓ Detached payment method: ${method.stripePaymentMethodId}${colors.reset}`);
            stats.paymentMethods.deleted++;
          }
        } catch (error) {
          // Already detached or doesn't exist
          stats.paymentMethods.skipped++;
        }
      }
    }
    
    console.log(`\n${colors.green}✓ Stripe cleanup complete:${colors.reset}`);
    console.log(`  • Connected Accounts: ${stats.connectedAccounts.deleted} deleted, ${stats.connectedAccounts.skipped} skipped`);
    console.log(`  • Customers: ${stats.customers.deleted} deleted, ${stats.customers.skipped} skipped`);
    console.log(`  • Payment Methods: ${stats.paymentMethods.deleted} deleted, ${stats.paymentMethods.skipped} skipped`);
    
  } catch (error) {
    console.error(`${colors.red}✗ Error during Stripe cleanup: ${error.message}${colors.reset}`);
    throw error;
  }
}

// Function to reset all database tables
async function resetDatabase() {
  try {
    console.log(`${colors.yellow}🗑️  Starting database reset...${colors.reset}`);
    
    // Delete data in order of dependencies (excluding settings)
    const deletionOrder = [
      // First, delete dependent records
      { model: 'notification', name: 'Notifications' },
      { model: 'message', name: 'Messages' },
      { model: 'conversation', name: 'Conversations' },
      { model: 'review', name: 'Reviews' },
      { model: 'payment', name: 'Payments' },
      { model: 'booking', name: 'Bookings' },
      { model: 'subscription', name: 'Subscriptions' },
      { model: 'favorite', name: 'Favorites' },
      { model: 'paymentMethod', name: 'Payment Methods' },
      { model: 'payout', name: 'Payouts' },
      { model: 'stripeAccount', name: 'Stripe Accounts' },
      { model: 'fieldClaim', name: 'Field Claims' },
      { model: 'field', name: 'Fields' },
      { model: 'userReport', name: 'User Reports' },
      { model: 'userBlock', name: 'User Blocks' },
      { model: 'otpVerification', name: 'OTP Verifications' },
      { model: 'user', name: 'Users' },
      // Settings data will be preserved:
      // - platformSettings (Platform Settings)
      // - aboutPage (About Page Content)
      // - fAQ (FAQs)
    ];
    
    for (const { model, name } of deletionOrder) {
      try {
        const count = await prisma[model].count();
        if (count > 0) {
          await prisma[model].deleteMany({});
          console.log(`${colors.green}✓ Deleted ${count} ${name}${colors.reset}`);
        } else {
          console.log(`${colors.cyan}ℹ️  No ${name} to delete${colors.reset}`);
        }
      } catch (error) {
        console.log(`${colors.yellow}⚠ Could not delete ${name}: ${error.message}${colors.reset}`);
      }
    }
    
    console.log(`${colors.green}✓ Database reset complete${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Error resetting database: ${error.message}${colors.reset}`);
    throw error;
  }
}

// Function to seed initial data
async function seedInitialData() {
  try {
    console.log(`${colors.yellow}🌱 Checking and seeding initial data...${colors.reset}`);
    
    // Check/Create default system settings (only if not exists)
    const existingSettings = await prisma.systemSettings.findFirst();
    if (!existingSettings) {
      await prisma.systemSettings.create({
        data: {
          defaultCommissionRate: 15,
          cancellationWindowHours: 24,
          maxBookingsPerUser: 10,
          minimumFieldOperatingHours: 4,
          payoutReleaseSchedule: 'after_cancellation_window',
          maintenanceMode: false,
          termsOfService: 'Default terms of service',
          privacyPolicy: 'Default privacy policy',
          contactEmail: 'support@fieldsy.com',
          supportPhone: '+353 1 234 5678'
        }
      });
      console.log(`${colors.green}✓ Created default system settings${colors.reset}`);
    } else {
      console.log(`${colors.cyan}ℹ️  System settings already exist (preserved)${colors.reset}`);
    }
    
    // Create test admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await prisma.user.create({
      data: {
        email: 'admin@fieldsy.com',
        name: 'Admin User',
        password: hashedPassword,
        role: 'ADMIN',
        emailVerified: new Date()
      }
    });
    console.log(`${colors.green}✓ Created admin user (admin@fieldsy.com / admin123)${colors.reset}`);
    
    // Create sample FAQs
    const faqs = [
      {
        question: 'How do I book a field?',
        answer: 'Simply search for fields in your area, select your preferred field, choose a date and time, and complete the booking.',
        order: 1,
        isActive: true
      },
      {
        question: 'What is the cancellation policy?',
        answer: 'You can cancel your booking up to 24 hours before the scheduled time for a full refund.',
        order: 2,
        isActive: true
      },
      {
        question: 'How do I become a field owner?',
        answer: 'Register as a field owner, add your field details, get verified, and start accepting bookings.',
        order: 3,
        isActive: true
      }
    ];
    
    for (const faq of faqs) {
      await prisma.fAQ.create({ data: faq });
    }
    console.log(`${colors.green}✓ Created ${faqs.length} sample FAQs${colors.reset}`);
    
    console.log(`${colors.green}✓ Initial data seeded successfully${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Error seeding data: ${error.message}${colors.reset}`);
    throw error;
  }
}

// Main function
async function main() {
  const isForced = process.argv.includes('--force');
  
  console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.red}⚠️  WARNING: COMPLETE DATA RESET ⚠️${colors.reset}`);
  console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.yellow}This script will:${colors.reset}`);
  console.log(`  • Delete ALL Stripe connected accounts`);
  console.log(`  • Delete ALL Stripe customers`);
  console.log(`  • Delete ALL Stripe payment methods`);
  console.log(`  • Delete ALL database records (except settings)`);
  console.log(`  • Create a test admin user`);
  console.log(`  • Preserve system settings, FAQs, and commission settings`);
  console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
  
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error(`${colors.red}✗ STRIPE_SECRET_KEY not found in environment variables${colors.reset}`);
    process.exit(1);
  }
  
  // Check if using test keys
  if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.error(`${colors.red}✗ PRODUCTION STRIPE KEY DETECTED! This script should only be used with test keys.${colors.reset}`);
    process.exit(1);
  }
  
  // Get confirmation unless forced
  if (!isForced) {
    const environment = process.env.NODE_ENV || 'development';
    console.log(`${colors.cyan}Current environment: ${environment}${colors.reset}`);
    console.log(`${colors.cyan}Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'}${colors.reset}`);
    
    const answer = await askQuestion(`${colors.yellow}\nType 'RESET ALL DATA' to confirm: ${colors.reset}`);
    
    if (answer !== 'RESET ALL DATA') {
      console.log(`${colors.yellow}Reset cancelled.${colors.reset}`);
      process.exit(0);
    }
    
    const doubleCheck = await askQuestion(`${colors.red}\nAre you ABSOLUTELY SURE? This cannot be undone! (yes/no): ${colors.reset}`);
    
    if (doubleCheck.toLowerCase() !== 'yes') {
      console.log(`${colors.yellow}Reset cancelled.${colors.reset}`);
      process.exit(0);
    }
  }
  
  console.log(`${colors.magenta}\n${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.magenta}Starting complete reset...${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(60)}${colors.reset}\n`);
  
  try {
    // Step 1: Delete all Stripe data (accounts, customers, payment methods)
    console.log(`${colors.blue}Step 1: Cleaning up all Stripe data${colors.reset}`);
    await deleteStripeData();
    
    // Step 2: Reset database
    console.log(`\n${colors.blue}Step 2: Resetting database${colors.reset}`);
    await resetDatabase();
    
    // Step 3: Seed initial data
    console.log(`\n${colors.blue}Step 3: Seeding initial data${colors.reset}`);
    await seedInitialData();
    
    console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}✅ COMPLETE RESET SUCCESSFUL!${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}\nYour system is now in a clean state with:${colors.reset}`);
    console.log(`  • No Stripe connected accounts`);
    console.log(`  • Empty database with default settings`);
    console.log(`  • Admin user: admin@fieldsy.com / admin123`);
    console.log(`  • Sample FAQs`);
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}\n`);
    
  } catch (error) {
    console.error(`\n${colors.red}${'='.repeat(60)}${colors.reset}`);
    console.error(`${colors.red}✗ RESET FAILED!${colors.reset}`);
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    console.error(`${colors.red}${'='.repeat(60)}${colors.reset}\n`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Run the script
main().catch(async (error) => {
  console.error(`${colors.red}Unexpected error: ${error.message}${colors.reset}`);
  await prisma.$disconnect();
  process.exit(1);
});