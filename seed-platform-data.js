const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedPlatformData() {
  try {
    console.log('🚀 Starting platform section data seed...');

    // Check if settings already exist
    let settings = await prisma.systemSettings.findFirst();

    const platformData = {
      platformTitle: "One Platform, Two Tail-Wagging Experiences",
      platformDogOwnersSubtitle: "For Dog Owners:",
      platformDogOwnersTitle: "Find & Book Private Dog Walking Fields in Seconds",
      platformDogOwnersBullets: [
        "Stress-free walks for reactive or energetic dogs",
        "Fully fenced, secure spaces",
        "GPS-powered search",
        "Instant hourly bookings"
      ],
      platformFieldOwnersSubtitle: "For Field Owners:",
      platformFieldOwnersTitle: "Turn Your Land into a Dog's Dream & Earn",
      platformFieldOwnersBullets: [
        "Earn passive income while helping pets",
        "Host dog owners with full control",
        "Set your availability and pricing",
        "List your field for free"
      ]
    };

    if (!settings) {
      // Create new settings with platform data
      settings = await prisma.systemSettings.create({
        data: {
          defaultCommissionRate: 20,
          cancellationWindowHours: 24,
          maxBookingsPerUser: 10,
          siteName: 'Fieldsy',
          siteUrl: 'https://fieldsy.com',
          supportEmail: 'support@fieldsy.com',
          maintenanceMode: false,
          enableNotifications: true,
          enableEmailNotifications: true,
          enableSmsNotifications: false,
          bannerText: 'Find Safe, private dog walking fields',
          highlightedText: 'near you',
          aboutTitle: 'At Fieldsy, we believe every dog deserves the freedom to run, sniff, and play safely.',
          ...platformData
        }
      });
      console.log('✅ Created new system settings with platform data');
    } else {
      // Update existing settings with platform data
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: platformData
      });
      console.log('✅ Updated existing system settings with platform data');
    }

    console.log('\n📋 Platform Section Data Saved:');
    console.log('=====================================');
    console.log(`Title: ${settings.platformTitle}`);
    console.log('\nDog Owners Card:');
    console.log(`  Subtitle: ${settings.platformDogOwnersSubtitle}`);
    console.log(`  Title: ${settings.platformDogOwnersTitle}`);
    console.log(`  Bullets:`);
    settings.platformDogOwnersBullets.forEach((bullet, i) => {
      console.log(`    ${i + 1}. ${bullet}`);
    });
    console.log('\nField Owners Card:');
    console.log(`  Subtitle: ${settings.platformFieldOwnersSubtitle}`);
    console.log(`  Title: ${settings.platformFieldOwnersTitle}`);
    console.log(`  Bullets:`);
    settings.platformFieldOwnersBullets.forEach((bullet, i) => {
      console.log(`    ${i + 1}. ${bullet}`);
    });
    console.log('=====================================\n');

    console.log('✅ Platform section data successfully saved to database!');
    console.log('👉 You can now edit this data in the admin panel at /settings under the "Platform Section" tab');

  } catch (error) {
    console.error('❌ Error seeding platform data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedPlatformData().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});