// Script to drop the existing unique index on bookingId using native MongoDB driver
const { MongoClient } = require('mongodb');

// Read MongoDB URI from environment
require('dotenv').config();
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

// Use the ACTUAL production database name (not the one in URI)
const dbName = 'fieldsy'; // The real production database

console.log(`Connecting to database: ${dbName} (PRODUCTION)`);

async function dropIndexes() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('field_reviews');

    // List all indexes
    console.log('\n📋 Current indexes on field_reviews:');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.name}:`, JSON.stringify(index.key));
      if (index.unique) {
        console.log(`     ⚠️  UNIQUE index`);
      }
    });

    // Drop the unique index on bookingId
    const indexName = 'field_reviews_bookingId_key';
    console.log(`\n🗑️  Attempting to drop index: ${indexName}`);

    try {
      const result = await collection.dropIndex(indexName);
      console.log(`✅ Successfully dropped index: ${indexName}`);
      console.log(result);
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log(`ℹ️  Index ${indexName} does not exist (already dropped or never created)`);
      } else {
        console.error(`❌ Error dropping index:`, error.message);
        throw error;
      }
    }

    // List indexes again to confirm
    console.log('\n📋 Indexes after cleanup:');
    const indexesAfter = await collection.indexes();
    indexesAfter.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Index cleanup complete!');
    console.log('You can now run: npx prisma db push');

  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

dropIndexes()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
