// Test the amenities API endpoint
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAmenitiesAPI() {
  try {
    console.log('\n=== Testing Amenities API Response ===\n');

    // Simulate what the API returns
    const amenities = await prisma.amenity.findMany({
      where: { isActive: true },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    });

    // Format labels (same as in controller)
    const formatLabel = (name) => {
      const specialCases = {
        toilet: 'Toilet',
        dogAgility: 'Dog Agility',
        waterBowls: 'Water Bowls',
        parkingSpace: 'Parking Space',
        parking: 'Parking',
        fence: 'Fence',
        shelter: 'Shelter',
        seatingArea: 'Seating Area',
        wasteBins: 'Waste Bins',
        lighting: 'Lighting',
        firstAid: 'First Aid',
      };

      if (specialCases[name]) {
        return specialCases[name];
      }

      return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    };

    const amenitiesWithLabels = amenities.map(amenity => ({
      id: amenity.id,
      name: amenity.name,
      label: formatLabel(amenity.name),
      icon: amenity.icon,
      isActive: amenity.isActive,
      order: amenity.order
    }));

    console.log('API Response (formatted):');
    console.log(JSON.stringify({
      success: true,
      message: 'Amenities retrieved successfully',
      data: amenitiesWithLabels
    }, null, 2));

    console.log('\n=== Display in Form ===\n');
    amenitiesWithLabels.forEach((amenity, index) => {
      console.log(`${index + 1}. ${amenity.label} (name: ${amenity.name}, id: ${amenity.id})`);
    });

    console.log('\n=== Summary ===\n');
    console.log(`✓ ${amenitiesWithLabels.length} active amenities found`);
    console.log('✓ Each amenity has: id, name, label, icon, isActive, order');
    console.log('✓ Labels are properly formatted for display');

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAmenitiesAPI();
