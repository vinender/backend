const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyPlatformData() {
  try {
    console.log('🔍 Verifying platform section data in database...\n');

    const settings = await prisma.systemSettings.findFirst({
      select: {
        platformTitle: true,
        platformDogOwnersSubtitle: true,
        platformDogOwnersTitle: true,
        platformDogOwnersBullets: true,
        platformFieldOwnersSubtitle: true,
        platformFieldOwnersTitle: true,
        platformFieldOwnersBullets: true,
        platformDogOwnersImage: true,
        platformFieldOwnersImage: true,
      }
    });

    if (!settings) {
      console.log('❌ No settings found in database!');
      console.log('Run: node seed-platform-data.js to create initial data');
      return;
    }

    console.log('✅ Platform data found in database:\n');
    console.log('=====================================');
    console.log('PLATFORM SECTION DATA');
    console.log('=====================================');
    
    console.log(`\n📌 Main Title:\n   "${settings.platformTitle}"`);
    
    console.log('\n🐕 DOG OWNERS CARD:');
    console.log(`   Subtitle: "${settings.platformDogOwnersSubtitle}"`);
    console.log(`   Title: "${settings.platformDogOwnersTitle}"`);
    console.log(`   Image: ${settings.platformDogOwnersImage || '[Not set - using default]'}`);
    console.log('   Bullet Points:');
    if (settings.platformDogOwnersBullets && settings.platformDogOwnersBullets.length > 0) {
      settings.platformDogOwnersBullets.forEach((bullet, i) => {
        console.log(`     ${i + 1}. ${bullet}`);
      });
    } else {
      console.log('     [No bullets defined]');
    }
    
    console.log('\n🏞️  FIELD OWNERS CARD:');
    console.log(`   Subtitle: "${settings.platformFieldOwnersSubtitle}"`);
    console.log(`   Title: "${settings.platformFieldOwnersTitle}"`);
    console.log(`   Image: ${settings.platformFieldOwnersImage || '[Not set - using default]'}`);
    console.log('   Bullet Points:');
    if (settings.platformFieldOwnersBullets && settings.platformFieldOwnersBullets.length > 0) {
      settings.platformFieldOwnersBullets.forEach((bullet, i) => {
        console.log(`     ${i + 1}. ${bullet}`);
      });
    } else {
      console.log('     [No bullets defined]');
    }

    console.log('\n=====================================');
    console.log('\n✅ Data is properly stored in the database!');
    console.log('📝 This data can be edited at: http://localhost:3003/settings (Platform Section tab)');
    console.log('🌐 Frontend will display this data at: http://localhost:3001');

  } catch (error) {
    console.error('❌ Error verifying platform data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyPlatformData();