const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixOrphanedFields() {
  try {
    console.log('🔍 Finding fields with missing owners...\n');

    // Find all fields
    const fields = await prisma.field.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true,
        _count: {
          select: {
            bookings: true
          }
        }
      }
    });

    // Get all user IDs
    const users = await prisma.user.findMany({
      select: { id: true }
    });
    const existingUserIds = new Set(users.map(u => u.id));

    // Find fields with missing owners
    const fieldsWithMissingOwners = fields.filter(f => !existingUserIds.has(f.ownerId));

    console.log(`📊 Total fields: ${fields.length}`);
    console.log(`⚠️  Fields with missing owners: ${fieldsWithMissingOwners.length}\n`);

    if (fieldsWithMissingOwners.length === 0) {
      console.log('✅ No orphaned fields found!');
      return;
    }

    // Group by whether they have bookings
    const fieldsWithBookings = fieldsWithMissingOwners.filter(f => f._count.bookings > 0);
    const fieldsWithoutBookings = fieldsWithMissingOwners.filter(f => f._count.bookings === 0);

    console.log(`📊 Fields with bookings: ${fieldsWithBookings.length}`);
    console.log(`📊 Fields without bookings: ${fieldsWithoutBookings.length}\n`);

    if (fieldsWithBookings.length > 0) {
      console.log('⚠️  Fields with bookings that have missing owners:');
      fieldsWithBookings.forEach(f => {
        console.log(`   - ${f.name} (ID: ${f.id}, Bookings: ${f._count.bookings})`);
      });
      console.log('\n❌ Cannot delete fields with bookings. Please manually reassign these fields to a valid owner.\n');
    }

    if (fieldsWithoutBookings.length > 0) {
      console.log('🗑️  Deleting fields without bookings...');

      const deleteResult = await prisma.field.deleteMany({
        where: {
          id: {
            in: fieldsWithoutBookings.map(f => f.id)
          }
        }
      });

      console.log(`✅ Deleted ${deleteResult.count} fields without bookings\n`);
    }

    // Show remaining issues
    if (fieldsWithBookings.length > 0) {
      console.log('📝 Manual action required:');
      console.log('   1. Find or create a valid user in the database');
      console.log('   2. Update the ownerId of these fields to point to a valid user:');
      fieldsWithBookings.forEach(f => {
        console.log(`      db.fields.updateOne({_id: ObjectId("${f.id}")}, {$set: {ownerId: ObjectId("VALID_USER_ID")}})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedFields();
