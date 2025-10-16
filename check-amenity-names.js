const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAmenityNames() {
  try {
    console.log('=== CHECKING AMENITY NAMES IN DATABASE ===\n');

    // Get all amenities
    const amenities = await prisma.amenity.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log(`Total amenities found: ${amenities.length}\n`);

    // Display all amenities
    amenities.forEach((amenity, index) => {
      console.log(`${index + 1}. Name: "${amenity.name}"`);
      console.log(`   ID: ${amenity.id}`);
      console.log(`   Icon: ${amenity.icon ? amenity.icon.substring(0, 50) + '...' : 'NULL'}`);
      console.log(`   Active: ${amenity.isActive}`);
      console.log('');
    });

    console.log('\n=== CHECKING FIELD AMENITIES ===\n');

    // Get a sample field to see what format amenities are stored in
    const sampleField = await prisma.field.findFirst({
      where: {
        amenities: {
          isEmpty: false,
        },
      },
      select: {
        id: true,
        name: true,
        amenities: true,
      },
    });

    if (sampleField) {
      console.log(`Sample Field: ${sampleField.name}`);
      console.log(`Field ID: ${sampleField.id}`);
      console.log(`Amenities Type: ${typeof sampleField.amenities}`);
      console.log(`Amenities:`, sampleField.amenities);
      console.log('\nAmenities breakdown:');
      sampleField.amenities.forEach((amenity, index) => {
        console.log(`  ${index + 1}. "${amenity}" (type: ${typeof amenity})`);
      });
    } else {
      console.log('No fields with amenities found');
    }

    console.log('\n=== NAME COMPARISON ===\n');

    if (sampleField && sampleField.amenities) {
      console.log('Field amenities vs Database amenities:\n');
      sampleField.amenities.forEach((fieldAmenity) => {
        const match = amenities.find(a => a.name === fieldAmenity);
        if (match) {
          console.log(`✅ "${fieldAmenity}" → FOUND in DB (ID: ${match.id})`);
        } else {
          console.log(`❌ "${fieldAmenity}" → NOT FOUND in DB`);
          // Try to find close matches
          const closeMatches = amenities.filter(a =>
            a.name.toLowerCase().includes(fieldAmenity.toLowerCase()) ||
            fieldAmenity.toLowerCase().includes(a.name.toLowerCase())
          );
          if (closeMatches.length > 0) {
            console.log(`   Possible matches:`);
            closeMatches.forEach(m => console.log(`     - "${m.name}"`));
          }
        }
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAmenityNames();
