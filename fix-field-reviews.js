// Script to fix FieldReview documents before adding unique constraint on bookingId
// This script removes duplicate null bookingId values by keeping only the latest review per field-user combination

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFieldReviews() {
  console.log('Starting FieldReview fix...');

  try {
    // Find all reviews with null bookingId
    const reviewsWithNullBooking = await prisma.fieldReview.findMany({
      where: {
        bookingId: null
      },
      orderBy: {
        createdAt: 'desc' // Most recent first
      }
    });

    console.log(`Found ${reviewsWithNullBooking.length} reviews with null bookingId`);

    if (reviewsWithNullBooking.length === 0) {
      console.log('No reviews with null bookingId found. Schema can be updated safely.');
      return;
    }

    // Group by fieldId + userId to find duplicates
    const reviewsByFieldUser = new Map();

    for (const review of reviewsWithNullBooking) {
      const key = `${review.fieldId}-${review.userId}`;
      if (!reviewsByFieldUser.has(key)) {
        reviewsByFieldUser.set(key, []);
      }
      reviewsByFieldUser.get(key).push(review);
    }

    // For each field-user combination with multiple reviews, keep the most recent and delete the rest
    let deletedCount = 0;

    for (const [key, reviews] of reviewsByFieldUser.entries()) {
      if (reviews.length > 1) {
        console.log(`\nFound ${reviews.length} reviews for ${key}:`);

        // Keep the first one (most recent due to sorting)
        const keepReview = reviews[0];
        console.log(`  ✓ Keeping review ${keepReview.id} (created: ${keepReview.createdAt})`);

        // Delete the rest
        for (let i = 1; i < reviews.length; i++) {
          const deleteReview = reviews[i];
          console.log(`  ✗ Deleting review ${deleteReview.id} (created: ${deleteReview.createdAt})`);

          await prisma.fieldReview.delete({
            where: { id: deleteReview.id }
          });
          deletedCount++;
        }
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Deleted ${deletedCount} duplicate reviews`);
    console.log(`   Kept ${reviewsWithNullBooking.length - deletedCount} reviews`);
    console.log('\nYou can now safely add the unique constraint on bookingId');

  } catch (error) {
    console.error('Error fixing field reviews:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixFieldReviews()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
