const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function renameCollection() {
  const mongoUri = process.env.DATABASE_URL || process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ Neither DATABASE_URL nor MONGODB_URI found in environment variables');
    console.log('Please make sure .env file exists with one of these variables');
    process.exit(1);
  }

  console.log(`📝 Using MongoDB URI: ${mongoUri.substring(0, 20)}...`);
  const client = new MongoClient(mongoUri);

  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();

    // Check if old collection exists
    const collections = await db.listCollections({ name: 'field_options' }).toArray();

    if (collections.length === 0) {
      console.log('⚠️  Collection "field_options" not found');

      // Check if new collection already exists
      const newCollections = await db.listCollections({ name: 'field_properties' }).toArray();
      if (newCollections.length > 0) {
        const count = await db.collection('field_properties').countDocuments();
        console.log(`✅ Collection "field_properties" already exists with ${count} documents`);
      } else {
        console.log('ℹ️  Neither collection exists. You may need to run the seed script.');
      }
      return;
    }

    console.log('📊 Found "field_options" collection');

    // Count documents in old collection
    const oldCount = await db.collection('field_options').countDocuments();
    console.log(`📝 Collection has ${oldCount} documents`);

    // Check if new collection already exists
    const newCollections = await db.listCollections({ name: 'field_properties' }).toArray();
    if (newCollections.length > 0) {
      console.log('⚠️  Warning: "field_properties" collection already exists!');
      const newCount = await db.collection('field_properties').countDocuments();
      console.log(`   It contains ${newCount} documents`);
      console.log('   The old collection will be renamed and merged.');
    }

    // Rename the collection
    console.log('🔄 Renaming collection from "field_options" to "field_properties"...');
    await db.collection('field_options').rename('field_properties', { dropTarget: true });

    // Verify the rename
    const verifyCollections = await db.listCollections({ name: 'field_properties' }).toArray();
    if (verifyCollections.length > 0) {
      const newCount = await db.collection('field_properties').countDocuments();
      console.log(`✅ Successfully renamed collection!`);
      console.log(`✅ "field_properties" now has ${newCount} documents`);
    } else {
      console.error('❌ Rename failed - collection not found after rename');
    }

  } catch (error) {
    console.error('❌ Error renaming collection:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the rename
renameCollection()
  .then(() => {
    console.log('\n✅ Collection rename completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Collection rename failed:', error);
    process.exit(1);
  });
