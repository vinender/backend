// Script to fix duplicate field_reviews with null bookingId in PRODUCTION database
// Run this on EC2 production server BEFORE running prisma db push

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

// Force use of production database
const dbName = 'fieldsy'; // The real production database

console.log('🚨 PRODUCTION DATABASE FIX 🚨');
console.log(`Database: ${dbName}`);
console.log('This will clean up duplicate field_reviews with null bookingId\n');

async function fixProductionReviews() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db(dbName);
    const collection = db.collection('field_reviews');

    // Count total reviews
    const totalReviews = await collection.countDocuments();
    console.log(`\n📊 Total field_reviews: ${totalReviews}`);

    // Find reviews with null bookingId
    const reviewsWithNull = await collection.find({ bookingId: null }).toArray();
    console.log(`   Reviews with null bookingId: ${reviewsWithNull.length}`);

    if (reviewsWithNull.length === 0) {
      console.log('\n✅ No reviews with null bookingId found!');
      console.log('   You can safely run: npx prisma db push');
      return;
    }

    // Group by fieldId + userId
    const grouped = new Map();
    for (const review of reviewsWithNull) {
      const key = `${review.fieldId}-${review.userId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(review);
    }

    console.log(`\n🔍 Found ${grouped.size} unique field-user combinations`);

    // Find duplicates
    let duplicateCount = 0;
    const toDelete = [];

    for (const [key, reviews] of grouped.entries()) {
      if (reviews.length > 1) {
        duplicateCount++;
        console.log(`\n⚠️  Duplicate found for ${key}:`);

        // Sort by createdAt descending (newest first)
        reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Keep the first (newest), mark rest for deletion
        console.log(`   ✓ KEEPING: ${reviews[0]._id} (${new Date(reviews[0].createdAt).toISOString()})`);

        for (let i = 1; i < reviews.length; i++) {
          console.log(`   ✗ DELETING: ${reviews[i]._id} (${new Date(reviews[i].createdAt).toISOString()})`);
          toDelete.push(reviews[i]._id);
        }
      }
    }

    if (toDelete.length === 0) {
      console.log('\n✅ No duplicates found! All reviews are unique.');
      console.log('   You can safely run: npx prisma db push');
      return;
    }

    console.log(`\n📝 Summary:`);
    console.log(`   - Field-user pairs with duplicates: ${duplicateCount}`);
    console.log(`   - Reviews to delete: ${toDelete.length}`);
    console.log(`   - Reviews to keep: ${reviewsWithNull.length - toDelete.length}`);

    // Ask for confirmation (auto-confirm in non-interactive mode)
    console.log(`\n⚡ Proceeding with deletion...`);

    // Delete duplicates
    const deleteResult = await collection.deleteMany({
      _id: { $in: toDelete }
    });

    console.log(`\n✅ Deleted ${deleteResult.deletedCount} duplicate reviews`);

    // Verify
    const remainingNulls = await collection.countDocuments({ bookingId: null });
    console.log(`\n📊 Verification:`);
    console.log(`   - Remaining reviews with null bookingId: ${remainingNulls}`);
    console.log(`   - Total reviews after cleanup: ${await collection.countDocuments()}`);

    console.log(`\n🎉 Success! You can now run: npx prisma db push`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixProductionReviews()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
