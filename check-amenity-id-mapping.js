// Check what IDs map to what names
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIdMapping() {
  try {
    console.log('\n=== Amenity ID to Name Mapping ===\n');

    const testIds = [
      '68e4c0b276753add3e8846e6',
      '68e4c0cf76753add3e8846e7'
    ];

    console.log('Looking up these IDs from your payload:');
    testIds.forEach(id => console.log(`  - ${id}`));
    console.log('');

    const amenities = await prisma.amenity.findMany({
      where: {
        id: {
          in: testIds
        }
      }
    });

    console.log('Found amenities:');
    amenities.forEach(a => {
      console.log(`  ID: ${a.id}`);
      console.log(`  Name: ${a.name}`);
      console.log(`  Label: ${formatLabel(a.name)}`);
      console.log('');
    });

    console.log('=== Conversion Process ===\n');
    console.log('Payload (IDs):');
    console.log(JSON.stringify(testIds, null, 2));
    console.log('');
    console.log('↓ Converted to names for storage ↓');
    console.log('');
    console.log('Database (Names):');
    console.log(JSON.stringify(amenities.map(a => a.name), null, 2));
    console.log('');

    if (amenities.some(a => a.name !== a.name.toLowerCase())) {
      console.log('⚠️  WARNING: Some amenity names are not in camelCase!');
      console.log('   These should be normalized to camelCase.');
    } else {
      console.log('✓ All amenity names are in camelCase format');
    }

    console.log('\n=== All Amenities ===\n');
    const allAmenities = await prisma.amenity.findMany({
      orderBy: { name: 'asc' }
    });

    allAmenities.forEach(a => {
      console.log(`${a.name.padEnd(20)} → ${formatLabel(a.name).padEnd(20)} (ID: ${a.id})`);
    });

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function formatLabel(name) {
  const specialCases = {
    toilet: 'Toilet',
    dogAgility: 'Dog Agility',
    waterBowls: 'Water Bowls',
    parkingSpace: 'Parking Space',
    parking: 'Parking',
    fence: 'Fence',
  };

  if (specialCases[name]) {
    return specialCases[name];
  }

  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

checkIdMapping();
