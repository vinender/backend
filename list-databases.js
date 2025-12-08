// Script to list all databases and collections
const { MongoClient } = require('mongodb');

require('dotenv').config();
const uri = process.env.MONGODB_URI;

async function listDatabases() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    // List all databases
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();

    console.log('\n📊 Available databases:');
    databases.databases.forEach((db) => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Check both possible databases
    const dbNames = ['fieldsy', 'fieldsy_db'];

    for (const dbName of dbNames) {
      console.log(`\n📁 Collections in "${dbName}":`);
      try {
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();

        if (collections.length === 0) {
          console.log(`   (no collections - database might not exist yet)`);
        } else {
          for (const coll of collections) {
            const collObj = db.collection(coll.name);
            const count = await collObj.countDocuments();
            console.log(`   - ${coll.name} (${count} documents)`);
          }
        }
      } catch (error) {
        console.log(`   Error: ${error.message}`);
      }
    }

  } finally {
    await client.close();
  }
}

listDatabases()
  .then(() => {
    console.log('\n✨ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
