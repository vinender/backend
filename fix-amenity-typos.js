const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAmenityTypos() {
  try {
    console.log('=== Fixing Amenity Typos ===\n');

    // List of typos to fix
    const typoFixes = [
      { old: 'Toiet', new: 'Toilet' },
      // Add more typos here if found
    ];

    for (const fix of typoFixes) {
      console.log(`Checking for: "${fix.old}"`);

      // Check if the typo exists
      const amenity = await prisma.amenity.findFirst({
        where: { name: fix.old }
      });

      if (amenity) {
        console.log(`  Found: ${amenity.name} (ID: ${amenity.id})`);

        // Update the name
        await prisma.amenity.update({
          where: { id: amenity.id },
          data: { name: fix.new }
        });

        console.log(`  ✅ Updated to: "${fix.new}"\n`);
      } else {
        console.log(`  ⏭️  Not found - skipping\n`);
      }
    }

    // List all amenities after fix
    console.log('=== Current Amenities ===');
    const allAmenities = await prisma.amenity.findMany({
      orderBy: { name: 'asc' }
    });

    allAmenities.forEach(amenity => {
      const iconStatus = amenity.icon ? '✅' : '❌';
      console.log(`${iconStatus} ${amenity.name}`);
    });

    console.log(`\nTotal: ${allAmenities.length} amenities`);
    console.log('\n✅ Amenity cleanup complete!');

  } catch (error) {
    console.error('Error fixing amenities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAmenityTypos();
