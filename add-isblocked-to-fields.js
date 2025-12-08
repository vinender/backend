// Script to add isBlocked field to all Field documents in production
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

const dbName = 'fieldsy'; // Production database

console.log('🚨 PRODUCTION DATABASE UPDATE 🚨');
console.log(`Database: ${dbName}`);
console.log('This will add isBlocked field to all Field documents\n');

async function addIsBlockedToFields() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db(dbName);
    const collection = db.collection('fields');

    // Count total fields
    const totalFields = await collection.countDocuments();
    console.log(`\n📊 Total fields: ${totalFields}`);

    // Count fields without isBlocked
    const fieldsWithoutIsBlocked = await collection.countDocuments({
      isBlocked: { $exists: false }
    });
    console.log(`   Fields without isBlocked: ${fieldsWithoutIsBlocked}`);

    if (fieldsWithoutIsBlocked === 0) {
      console.log('\n✅ All fields already have isBlocked field!');
      return;
    }

    console.log(`\n⚡ Adding isBlocked: false to ${fieldsWithoutIsBlocked} fields...`);

    // Add isBlocked field to all documents that don't have it
    const result = await collection.updateMany(
      { isBlocked: { $exists: false } },
      { $set: { isBlocked: false } }
    );

    console.log(`\n✅ Updated ${result.modifiedCount} fields`);

    // Verify
    const remainingWithout = await collection.countDocuments({
      isBlocked: { $exists: false }
    });

    console.log(`\n📊 Verification:`);
    console.log(`   - Fields without isBlocked: ${remainingWithout}`);
    console.log(`   - Total fields: ${await collection.countDocuments()}`);

    if (remainingWithout === 0) {
      console.log(`\n🎉 Success! All fields now have isBlocked field`);
    } else {
      console.warn(`\n⚠️  Warning: ${remainingWithout} fields still missing isBlocked`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

addIsBlockedToFields()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
