// Fix any remaining Title Case amenity names in fields
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFieldAmenityNames() {
  try {
    console.log('\n=== Fixing Field Amenity Names ===\n');

    // Get all fields with amenities
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

    console.log(`Found ${fields.length} fields with amenities\n`);

    // Mapping of Title Case to camelCase
    const nameMapping = {
      'Fence': 'fence',
      'Parking': 'parking',
      'Toilet': 'toilet',
      'Dog Agility': 'dogAgility',
      'dogAgility': 'dogAgility', // Already correct
      'fence': 'fence', // Already correct
      'parking': 'parking', // Already correct
      'toilet': 'toilet', // Already correct
      'Water Bowls': 'waterBowls',
      'Parking Space': 'parkingSpace',
      'Shelter': 'shelter',
      'Seating Area': 'seatingArea',
      'Waste Bins': 'wasteBins',
      'Lighting': 'lighting',
      'First Aid': 'firstAid'
    };

    let updatedCount = 0;

    for (const field of fields) {
      // Check if any amenities need to be converted
      const updatedAmenities = field.amenities.map(amenity => {
        return nameMapping[amenity] || amenity.charAt(0).toLowerCase() + amenity.slice(1).replace(/\s+/g, '');
      });

      // Only update if there were changes
      const hasChanges = JSON.stringify(field.amenities) !== JSON.stringify(updatedAmenities);

      if (hasChanges) {
        console.log(`Updating field: ${field.name}`);
        console.log(`  Before: ${JSON.stringify(field.amenities)}`);
        console.log(`  After:  ${JSON.stringify(updatedAmenities)}`);

        await prisma.field.update({
          where: { id: field.id },
          data: { amenities: updatedAmenities }
        });

        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      console.log('✓ All fields already have camelCase amenity names');
    } else {
      console.log(`\n✓ Updated ${updatedCount} field(s)`);
    }

    // Show final state
    console.log('\n=== Final Field Amenities ===\n');
    const finalFields = await prisma.field.findMany({
      where: {
        amenities: {
          isEmpty: false
        }
      },
      select: {
        id: true,
        name: true,
        amenities: true
      },
      orderBy: { name: 'asc' }
    });

    finalFields.forEach(field => {
      console.log(`${field.name}:`);
      console.log(`  ${JSON.stringify(field.amenities)}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFieldAmenityNames();
