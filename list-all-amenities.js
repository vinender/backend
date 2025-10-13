// List all amenities in the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAllAmenities() {
  try {
    console.log('\n=== All Amenities in Database ===\n');

    const amenities = await prisma.amenity.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`Total: ${amenities.length} amenities\n`);

    amenities.forEach((a, index) => {
      console.log(`${index}. ${a.name} (ID: ${a.id}, Active: ${a.isActive})`);
    });

    console.log('\n=== Fields Using Amenities ===\n');

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

    fields.forEach(field => {
      console.log(`\nField: ${field.name}`);
      console.log(`Amenities: ${JSON.stringify(field.amenities)}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllAmenities();
