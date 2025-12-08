// Script to drop the existing unique index on bookingId in field_reviews collection
// This is needed because the old index doesn't allow multiple null values

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function dropBookingIdIndex() {
  console.log('Starting index cleanup...');

  try {
    // Get the MongoDB client from Prisma
    const db = prisma.$extends({
      client: {
        async $runCommand(command) {
          return await prisma.$runCommandRaw(command);
        }
      }
    });

    // List all indexes on field_reviews collection
    console.log('\nListing all indexes on field_reviews collection:');
    const indexes = await prisma.$runCommandRaw({
      listIndexes: 'field_reviews'
    });

    console.log(JSON.stringify(indexes, null, 2));

    // Drop the unique index on bookingId if it exists
    console.log('\nAttempting to drop field_reviews_bookingId_key index...');

    try {
      await prisma.$runCommandRaw({
        dropIndexes: 'field_reviews',
        index: 'field_reviews_bookingId_key'
      });
      console.log('✅ Successfully dropped field_reviews_bookingId_key index');
    } catch (dropError) {
      console.log('Index might not exist or already dropped:', dropError.message);
    }

    console.log('\n✅ Index cleanup complete!');
    console.log('You can now run: npx prisma db push');

  } catch (error) {
    console.error('Error during index cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

dropBookingIdIndex()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
