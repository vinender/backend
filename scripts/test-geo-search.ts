import prisma from '../src/config/database';
import FieldModel from '../src/models/field.model';

async function testGeoSearch() {
    console.log('Testing Geospatial Search...');

    // 1. Create a dummy field at a known location (e.g., London Eye)
    // Lat: 51.5033, Lng: -0.1195
    const londonEye = { lat: 51.5033, lng: -0.1195 };

    // Create a dummy owner first
    const owner = await prisma.user.create({
        data: {
            email: `geo-test-${Date.now()}@example.com`,
            name: 'Geo Test User',
            role: 'FIELD_OWNER'
        }
    });

    const field = await prisma.field.create({
        data: {
            name: 'London Eye Field',
            ownerId: owner.id,
            latitude: londonEye.lat,
            longitude: londonEye.lng,
            location: {
                type: 'Point',
                coordinates: [londonEye.lng, londonEye.lat] // GeoJSON is [lng, lat]
            },
            isActive: true,
            isSubmitted: true
        }
    });

    console.log(`Created test field: ${field.name} at [${londonEye.lat}, ${londonEye.lng}]`);

    // 2. Search from nearby (e.g., Big Ben, ~0.5 miles away)
    // Lat: 51.5007, Lng: -0.1246
    const bigBen = { lat: 51.5007, lng: -0.1246 };
    console.log(`Searching from Big Ben [${bigBen.lat}, ${bigBen.lng}]...`);

    const nearbyFields = await FieldModel.searchByLocation(bigBen.lat, bigBen.lng, 1); // 1 mile radius

    const found = nearbyFields.find(f => f.id === field.id);

    if (found) {
        console.log(`✅ Success! Found field. Distance: ${found.distanceMiles} miles.`);
    } else {
        console.error('❌ Failed! Field not found in nearby search.');
        console.log('Found fields:', nearbyFields.map(f => `${f.name} (${f.distanceMiles}m)`));
    }

    // 3. Search from far away (e.g., Manchester, ~160 miles away)
    // Lat: 53.4808, Lng: -2.2426
    const manchester = { lat: 53.4808, lng: -2.2426 };
    console.log(`Searching from Manchester [${manchester.lat}, ${manchester.lng}]...`);

    const farFields = await FieldModel.searchByLocation(manchester.lat, manchester.lng, 10); // 10 mile radius

    const foundFar = farFields.find(f => f.id === field.id);

    if (!foundFar) {
        console.log('✅ Success! Field correctly excluded from far search.');
    } else {
        console.error('❌ Failed! Field found in far search (should be excluded).');
    }

    // Cleanup
    await prisma.field.delete({ where: { id: field.id } });
    await prisma.user.delete({ where: { id: owner.id } });
    console.log('Cleanup complete.');
}

testGeoSearch()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
