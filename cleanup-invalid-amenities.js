// Clean up invalid amenity entries
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupInvalidAmenities() {
  try {
    console.log('\n=== Cleaning Up Invalid Amenities ===\n');

    // 1. Find invalid amenities (numeric strings like "0", "1", "2", "3")
    console.log('1. Finding invalid amenities...');
    const invalidNames = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    const invalidAmenities = await prisma.amenity.findMany({
      where: {
        name: {
          in: invalidNames
        }
      }
    });

    console.log(`   Found ${invalidAmenities.length} invalid amenities:`);
    invalidAmenities.forEach(a => {
      console.log(`   - "${a.name}" (ID: ${a.id})`);
    });

    if (invalidAmenities.length === 0) {
      console.log('   No invalid amenities found!');
      return;
    }

    // 2. Find fields that reference these invalid amenities
    console.log('\n2. Finding fields with invalid amenity references...');
    const fieldsWithInvalid = await prisma.field.findMany({
      where: {
        OR: invalidNames.map(name => ({
          amenities: {
            has: name
          }
        }))
      },
      select: {
        id: true,
        name: true,
        amenities: true
      }
    });

    console.log(`   Found ${fieldsWithInvalid.length} fields with invalid amenities`);

    // 3. Update fields to remove invalid amenity references
    if (fieldsWithInvalid.length > 0) {
      console.log('\n3. Cleaning up field amenity references...');

      for (const field of fieldsWithInvalid) {
        const cleanedAmenities = field.amenities.filter(
          amenity => !invalidNames.includes(amenity)
        );

        console.log(`   - ${field.name}:`);
        console.log(`     Before: ${JSON.stringify(field.amenities)}`);
        console.log(`     After:  ${JSON.stringify(cleanedAmenities)}`);

        await prisma.field.update({
          where: { id: field.id },
          data: { amenities: cleanedAmenities }
        });
      }

      console.log('   ✓ Field references cleaned');
    }

    // 4. Delete invalid amenities
    console.log('\n4. Deleting invalid amenities...');
    const deleteResult = await prisma.amenity.deleteMany({
      where: {
        name: {
          in: invalidNames
        }
      }
    });

    console.log(`   ✓ Deleted ${deleteResult.count} invalid amenities`);

    // 5. Show current state
    console.log('\n5. Current amenities in database:');
    const allAmenities = await prisma.amenity.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`   Total: ${allAmenities.length} amenities`);
    allAmenities.forEach(a => {
      console.log(`   - ${a.name} (ID: ${a.id})`);
    });

    console.log('\n=== Cleanup Complete ===\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupInvalidAmenities();
