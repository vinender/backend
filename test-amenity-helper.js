const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Normalize amenity name for comparison
 */
function normalizeAmenityName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Format amenity slug to readable label (fallback)
 */
function formatAmenityLabel(slug) {
  if (!slug) return '';

  return slug
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

/**
 * Fetch amenities from database and transform them
 */
async function fetchAndTransformAmenities(amenitySlugs) {
  if (!Array.isArray(amenitySlugs) || amenitySlugs.length === 0) {
    return [];
  }

  try {
    // Fetch all active amenities from database
    const dbAmenities = await prisma.amenity.findMany({
      where: { isActive: true },
      select: {
        name: true,
        icon: true
      }
    });

    console.log(`\nFound ${dbAmenities.length} amenities in database`);

    // Create a map for faster lookup
    const amenityMap = new Map();
    dbAmenities.forEach(amenity => {
      const normalizedName = normalizeAmenityName(amenity.name);
      amenityMap.set(normalizedName, amenity);
      console.log(`  - ${amenity.name} -> ${normalizedName}`);
    });

    // Match field amenities with database amenities
    const transformedAmenities = [];

    console.log(`\nMatching ${amenitySlugs.length} field amenities:`);
    for (const slug of amenitySlugs) {
      const normalizedSlug = normalizeAmenityName(slug);
      const dbAmenity = amenityMap.get(normalizedSlug);

      console.log(`  Field amenity: "${slug}" -> normalized: "${normalizedSlug}"`);

      if (dbAmenity) {
        console.log(`    ✅ MATCH FOUND: "${dbAmenity.name}"`);
        transformedAmenities.push({
          label: dbAmenity.name,
          iconUrl: dbAmenity.icon || '/field-details/shield.svg'
        });
      } else {
        console.log(`    ❌ NO MATCH - Using fallback`);
        transformedAmenities.push({
          label: formatAmenityLabel(slug),
          iconUrl: '/field-details/shield.svg'
        });
      }
    }

    return transformedAmenities;
  } catch (error) {
    console.error('Error fetching amenities:', error);
    return amenitySlugs.map(slug => ({
      label: formatAmenityLabel(slug),
      iconUrl: '/field-details/shield.svg'
    }));
  }
}

async function testAmenityHelper() {
  try {
    console.log('=== Testing Amenity Helper ===\n');

    // Test with sample field amenities
    const testAmenities = ['dogAgility', 'toilet', 'parking', 'fence'];

    console.log(`Testing with amenities: ${JSON.stringify(testAmenities)}`);

    const result = await fetchAndTransformAmenities(testAmenities);

    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAmenityHelper();
