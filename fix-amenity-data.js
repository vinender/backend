// Fix amenity data - add missing amenities or update field data
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAmenityData() {
  try {
    console.log('\n=== Fixing Amenity Data ===\n');

    // 1. Check what amenities are referenced in fields
    console.log('1. Finding all unique amenity names in fields...');
    const fields = await prisma.field.findMany({
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

    const allAmenityNames = new Set();
    fields.forEach(field => {
      field.amenities.forEach(amenity => allAmenityNames.add(amenity));
    });

    console.log(`   Found ${allAmenityNames.size} unique amenity names in fields:`);
    console.log(`   ${Array.from(allAmenityNames).join(', ')}`);

    // 2. Check what amenities exist in database
    console.log('\n2. Checking amenities in database...');
    const existingAmenities = await prisma.amenity.findMany();
    console.log(`   Found ${existingAmenities.length} amenities in database:`);
    existingAmenities.forEach(a => {
      console.log(`   - ${a.name} (ID: ${a.id})`);
    });

    // 3. Find missing amenities
    const existingNames = new Set(existingAmenities.map(a => a.name));
    const missingAmenities = Array.from(allAmenityNames).filter(name => !existingNames.has(name));

    if (missingAmenities.length > 0) {
      console.log(`\n3. Creating ${missingAmenities.length} missing amenities...`);

      for (const name of missingAmenities) {
        const label = formatLabel(name);
        console.log(`   Creating: ${name} (${label})`);

        await prisma.amenity.create({
          data: {
            name: name,
            icon: null,
            isActive: true,
            order: 0
          }
        });
      }

      console.log('   ✓ Missing amenities created');
    } else {
      console.log('\n3. No missing amenities - all field amenities exist in database');
    }

    // 4. Verify enrichment now works
    console.log('\n4. Testing enrichment after fix...');
    const testField = fields[0];
    if (testField) {
      const enrichedAmenities = await prisma.amenity.findMany({
        where: {
          name: {
            in: testField.amenities
          }
        }
      });

      console.log(`   Field: ${testField.name}`);
      console.log(`   Stored amenities: ${JSON.stringify(testField.amenities)}`);
      console.log(`   Enriched (${enrichedAmenities.length} found):`);
      enrichedAmenities.forEach(a => {
        console.log(`   - ${a.name} → ${formatLabel(a.name)} (ID: ${a.id})`);
      });
    }

    console.log('\n=== Fix Complete ===\n');

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

fixAmenityData();
