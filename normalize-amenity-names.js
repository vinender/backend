// Normalize amenity names to consistent camelCase format
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function normalizeAmenityNames() {
  try {
    console.log('\n=== Normalizing Amenity Names ===\n');

    // Define naming mapping (Title Case → camelCase)
    const nameMapping = {
      'Fence': 'fence',
      'Parking': 'parking',
      'dogAgility': 'dogAgility', // Already correct
      'toilet': 'toilet', // Already correct
      'Water Bowls': 'waterBowls',
      'Dog Agility': 'dogAgility',
      'Parking Space': 'parkingSpace',
      'Shelter': 'shelter',
      'Seating Area': 'seatingArea',
      'Waste Bins': 'wasteBins',
      'Lighting': 'lighting',
      'First Aid': 'firstAid'
    };

    // Get all amenities
    const amenities = await prisma.amenity.findMany();

    console.log(`Found ${amenities.length} amenities\n`);

    // Update each amenity with normalized name
    for (const amenity of amenities) {
      const normalizedName = nameMapping[amenity.name] || amenity.name.charAt(0).toLowerCase() + amenity.name.slice(1).replace(/\s+/g, '');

      if (normalizedName !== amenity.name) {
        console.log(`Updating: "${amenity.name}" → "${normalizedName}"`);

        // Check if normalized name already exists
        const existing = await prisma.amenity.findUnique({
          where: { name: normalizedName }
        });

        if (existing && existing.id !== amenity.id) {
          console.log(`  ⚠️  "${normalizedName}" already exists (ID: ${existing.id})`);
          console.log(`  → Updating fields that use "${amenity.name}" to use "${normalizedName}"`);

          // Update all fields that reference the old name
          const fieldsWithOldName = await prisma.field.findMany({
            where: {
              amenities: {
                has: amenity.name
              }
            }
          });

          for (const field of fieldsWithOldName) {
            const updatedAmenities = field.amenities.map(a =>
              a === amenity.name ? normalizedName : a
            );

            await prisma.field.update({
              where: { id: field.id },
              data: { amenities: updatedAmenities }
            });

            console.log(`    - Updated field: ${field.name}`);
          }

          // Delete the duplicate amenity
          console.log(`  → Deleting duplicate amenity "${amenity.name}"`);
          await prisma.amenity.delete({
            where: { id: amenity.id }
          });
        } else {
          // Just update the name
          await prisma.amenity.update({
            where: { id: amenity.id },
            data: { name: normalizedName }
          });
          console.log(`  ✓ Updated`);

          // Update fields that reference this amenity
          const fieldsWithOldName = await prisma.field.findMany({
            where: {
              amenities: {
                has: amenity.name
              }
            }
          });

          for (const field of fieldsWithOldName) {
            const updatedAmenities = field.amenities.map(a =>
              a === amenity.name ? normalizedName : a
            );

            await prisma.field.update({
              where: { id: field.id },
              data: { amenities: updatedAmenities }
            });
          }
        }
      }
    }

    // Show final state
    console.log('\n=== Final Amenities ===\n');
    const finalAmenities = await prisma.amenity.findMany({
      orderBy: { name: 'asc' }
    });

    finalAmenities.forEach(a => {
      console.log(`- ${a.name} (ID: ${a.id})`);
    });

    console.log('\n=== Complete ===\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

normalizeAmenityNames();
