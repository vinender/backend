const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicateAccounts() {
  try {
    console.log('=== Checking for Duplicate Accounts ===\n');

    // 1. Get all users
    const users = await prisma.user.findMany({
      include: {
        accounts: true
      },
      orderBy: {
        email: 'asc'
      }
    });

    console.log(`Total users in database: ${users.length}\n`);

    // 2. Group users by email
    const emailGroups = {};
    users.forEach(user => {
      if (!emailGroups[user.email]) {
        emailGroups[user.email] = [];
      }
      emailGroups[user.email].push(user);
    });

    // 3. Find duplicate emails
    console.log('=== Checking for duplicate emails ===');
    let duplicateCount = 0;
    for (const [email, userList] of Object.entries(emailGroups)) {
      if (userList.length > 1) {
        duplicateCount++;
        console.log(`\n⚠️ DUPLICATE: ${email}`);
        userList.forEach(user => {
          console.log(`  - ID: ${user.id}`);
          console.log(`    Role: ${user.role}`);
          console.log(`    Name: ${user.name}`);
          console.log(`    Created: ${user.createdAt}`);
          console.log(`    OAuth Accounts: ${user.accounts.length}`);
          if (user.accounts.length > 0) {
            user.accounts.forEach(oauth => {
              console.log(`      - Provider: ${oauth.provider}, Provider ID: ${oauth.providerAccountId}`);
            });
          }
        });
      }
    }

    if (duplicateCount === 0) {
      console.log('✅ No duplicate emails found');
    } else {
      console.log(`\n❌ Found ${duplicateCount} emails with multiple accounts`);
    }

    // 4. Check OAuth accounts
    console.log('\n=== Checking OAuth Accounts ===');
    const oauthAccounts = await prisma.account.findMany({
      include: {
        user: true
      }
    });

    console.log(`Total OAuth accounts: ${oauthAccounts.length}`);

    // Group by provider account ID
    const providerGroups = {};
    oauthAccounts.forEach(oauth => {
      const key = `${oauth.provider}:${oauth.providerAccountId}`;
      if (!providerGroups[key]) {
        providerGroups[key] = [];
      }
      providerGroups[key].push(oauth);
    });

    // Check for duplicate OAuth accounts
    console.log('\n=== Checking for duplicate OAuth provider accounts ===');
    let oauthDuplicates = 0;
    for (const [key, oauthList] of Object.entries(providerGroups)) {
      if (oauthList.length > 1) {
        oauthDuplicates++;
        const [provider, providerId] = key.split(':');
        console.log(`\n⚠️ DUPLICATE OAUTH: ${provider} account ${providerId}`);
        oauthList.forEach(oauth => {
          console.log(`  - User: ${oauth.user.email} (${oauth.user.role})`);
          console.log(`    User ID: ${oauth.userId}`);
        });
      }
    }

    if (oauthDuplicates === 0) {
      console.log('✅ No duplicate OAuth accounts found');
    } else {
      console.log(`\n❌ Found ${oauthDuplicates} OAuth accounts linked to multiple users`);
    }

    // 5. Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total users: ${users.length}`);
    console.log(`Unique emails: ${Object.keys(emailGroups).length}`);
    console.log(`Duplicate emails: ${duplicateCount}`);
    console.log(`OAuth accounts: ${oauthAccounts.length}`);
    console.log(`Duplicate OAuth accounts: ${oauthDuplicates}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateAccounts();