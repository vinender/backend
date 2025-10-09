const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const fieldOptions = [
  // Field Size
  { category: 'fieldSize', value: 'small', label: 'Small (1 acre or less)', order: 1 },
  { category: 'fieldSize', value: 'medium', label: 'Medium (1-3 acres)', order: 2 },
  { category: 'fieldSize', value: 'large', label: 'Large (3+ acres)', order: 3 },

  // Terrain Type
  { category: 'terrainType', value: 'soft-grass', label: 'Soft Grass', order: 1 },
  { category: 'terrainType', value: 'walking-path', label: 'Walking Path', order: 2 },
  { category: 'terrainType', value: 'wood-chips', label: 'Wood Chips', order: 3 },
  { category: 'terrainType', value: 'artificial-grass', label: 'Artificial Grass', order: 4 },
  { category: 'terrainType', value: 'mixed-terrain', label: 'Mixed Terrain', order: 5 },

  // Fence Type
  { category: 'fenceType', value: 'post-and-wire', label: 'Post and Wire', order: 1 },
  { category: 'fenceType', value: 'wooden-panel', label: 'Wooden Panel', order: 2 },
  { category: 'fenceType', value: 'fully-enclosed-field-fencing', label: 'Fully Enclosed Field Fencing', order: 3 },
  { category: 'fenceType', value: 'metal-rail', label: 'Metal Rail', order: 4 },
  { category: 'fenceType', value: 'mixed-multiple-types', label: 'Mixed/Multiple Types', order: 5 },
  { category: 'fenceType', value: 'no-fence', label: 'No Fence', order: 6 },

  // Fence Size
  { category: 'fenceSize', value: 'under-1-metre', label: 'Under 1 metre (3 ft)', order: 1 },
  { category: 'fenceSize', value: '1-2-metres', label: '1-2 metres (3-6 ft)', order: 2 },
  { category: 'fenceSize', value: '2-3-metres', label: '2-3 metres (6-9 ft)', order: 3 },
  { category: 'fenceSize', value: '3-4-metres', label: '3-4 metres (9-12 ft)', order: 4 },
  { category: 'fenceSize', value: '4-5-metres', label: '4-5 metres (12-15 ft)', order: 5 },
  { category: 'fenceSize', value: '5-6-metres', label: '5-6 metres (15-18 ft)', order: 6 },
  { category: 'fenceSize', value: '6-7-metres', label: '6-7 metres (18-21 ft)', order: 7 },
  { category: 'fenceSize', value: '7-8-metres', label: '7-8 metres (21-24 ft)', order: 8 },
  { category: 'fenceSize', value: '8-9-metres', label: '8-9 metres (24-27 ft)', order: 9 },
  { category: 'fenceSize', value: '9-10-metres', label: '9-10 metres (27-30 ft)', order: 10 },

  // Surface Type
  { category: 'surfaceType', value: 'grass', label: 'Grass', order: 1 },
  { category: 'surfaceType', value: 'gravel', label: 'Gravel', order: 2 },
  { category: 'surfaceType', value: 'meadow', label: 'Meadow', order: 3 },
  { category: 'surfaceType', value: 'paved-path', label: 'Paved Path', order: 4 },
  { category: 'surfaceType', value: 'flat-with-gentle-slopes', label: 'Flat with Gentle Slopes', order: 5 },
  { category: 'surfaceType', value: 'muddy', label: 'Muddy', order: 6 },
  { category: 'surfaceType', value: 'other', label: 'Other', order: 7 },

  // Opening Days
  { category: 'openingDays', value: 'everyday', label: 'Every day', order: 1 },
  { category: 'openingDays', value: 'weekdays', label: 'Weekdays only', order: 2 },
  { category: 'openingDays', value: 'weekends', label: 'Weekends only', order: 3 }
];

async function main() {
  console.log('Starting field options seed...');

  try {
    // Delete existing field options
    await prisma.fieldProperty.deleteMany({});
    console.log('Cleared existing field options');

    // Insert new field options
    for (const option of fieldOptions) {
      await prisma.fieldProperty.create({
        data: option
      });
    }

    console.log(`✅ Successfully seeded ${fieldOptions.length} field options`);

    // Group by category and count
    const categories = fieldOptions.reduce((acc, opt) => {
      acc[opt.category] = (acc[opt.category] || 0) + 1;
      return acc;
    }, {});

    console.log('\nOptions per category:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} options`);
    });

  } catch (error) {
    console.error('Error seeding field options:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
