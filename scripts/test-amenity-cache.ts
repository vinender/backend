import { enrichFieldsWithAmenities } from '../src/utils/amenity.utils';
import prisma from '../src/config/database';

async function testAmenityCache() {
    console.log('Testing Amenity Caching...');

    // Create a dummy field object
    const dummyField = {
        id: 'test-field',
        name: 'Test Field',
        amenities: ['dogAgility', 'waterBowls'] // These should exist or be normalized
    };

    console.log('1. First call (should hit DB)...');
    const start1 = performance.now();
    await enrichFieldsWithAmenities([dummyField]);
    const end1 = performance.now();
    console.log(`First call took: ${(end1 - start1).toFixed(2)}ms`);

    console.log('2. Second call (should hit Cache)...');
    const start2 = performance.now();
    await enrichFieldsWithAmenities([dummyField]);
    const end2 = performance.now();
    console.log(`Second call took: ${(end2 - start2).toFixed(2)}ms`);

    if ((end2 - start2) < (end1 - start1) / 2) {
        console.log('✅ Success! Second call was significantly faster.');
    } else {
        console.warn('⚠️ Warning: Cache might not be working effectively or DB is too fast to notice difference.');
    }
}

testAmenityCache()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
