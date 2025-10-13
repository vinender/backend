// Test amenity enrichment
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAmenityEnrichment() {
  try {
    console.log('\n=== Testing Amenity Enrichment ===\n');

    // 1. Get all amenities from DB
    console.log('1. Fetching all amenities from database...');
    const amenities = await prisma.amenity.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`   Found ${amenities.length} amenities:`);
    amenities.forEach(a => {
      console.log(`   - ${a.name} (ID: ${a.id})`);
    });

    // 2. Test transformation of specific amenity names
    console.log('\n2. Testing transformation of ["dogAgility", "toilet"]...');
    const testNames = ['dogAgility', 'toilet'];

    const matchedAmenities = await prisma.amenity.findMany({
      where: {
        name: {
          in: testNames
        }
      }
    });

    console.log(`   Found ${matchedAmenities.length} matches:`);
    matchedAmenities.forEach(a => {
      console.log(`   - ${a.name} (ID: ${a.id}, Icon: ${a.icon || 'none'})`);
    });

    // 3. Transform to full objects
    console.log('\n3. Transforming to full objects...');
    const transformed = matchedAmenities.map(a => ({
      id: a.id,
      value: a.name,
      label: formatLabel(a.name),
      icon: a.icon
    }));

    console.log('   Result:');
    console.log(JSON.stringify(transformed, null, 2));

    // 4. Get a sample field with amenities
    console.log('\n4. Finding a field with amenities...');
    const fieldWithAmenities = await prisma.field.findFirst({
      where: {
        amenities: {
          isEmpty: false
        }
      },
      select: {
        id: true,
        name: true,
        amenities: true
      }
    });

    if (fieldWithAmenities) {
      console.log(`   Found field: ${fieldWithAmenities.name}`);
      console.log(`   Stored amenities: ${JSON.stringify(fieldWithAmenities.amenities)}`);

      // Transform this field's amenities
      const fieldAmenities = await prisma.amenity.findMany({
        where: {
          name: {
            in: fieldWithAmenities.amenities
          }
        }
      });

      const transformedFieldAmenities = fieldAmenities.map(a => ({
        id: a.id,
        value: a.name,
        label: formatLabel(a.name),
        icon: a.icon
      }));

      console.log('\n   Enriched amenities:');
      console.log(JSON.stringify(transformedFieldAmenities, null, 2));
    } else {
      console.log('   No fields with amenities found');
    }

    console.log('\n=== Test Complete ===\n');

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
  };

  if (specialCases[name]) {
    return specialCases[name];
  }

  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

testAmenityEnrichment();
