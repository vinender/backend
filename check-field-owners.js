const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFieldOwners() {
  try {
    console.log('🔍 Checking field owners...\n');

    // Find all fields and their owners
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

    console.log(`📊 Total fields: ${fields.length}\n`);

    // Check for fields with null owners
    const fieldsWithNullOwner = fields.filter(f => f.ownerId === null);
    console.log(`⚠️  Fields with null ownerId: ${fieldsWithNullOwner.length}`);

    if (fieldsWithNullOwner.length > 0) {
      console.log('\nFields with null owners:');
      fieldsWithNullOwner.forEach(f => {
        console.log(`  - ID: ${f.id}, Name: ${f.name}, Bookings: ${f._count.bookings}`);
      });
    }

    // Check if owners actually exist for fields with ownerIds
    const fieldsWithOwners = fields.filter(f => f.ownerId !== null);
    console.log(`\n✅ Fields with ownerId set: ${fieldsWithOwners.length}`);

    // Verify owners exist
    console.log('\n🔍 Verifying owners exist...');
    const ownerIds = [...new Set(fieldsWithOwners.map(f => f.ownerId))];
    const owners = await prisma.user.findMany({
      where: {
        id: { in: ownerIds }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    console.log(`📊 Unique owner IDs referenced: ${ownerIds.length}`);
    console.log(`📊 Actual owners found: ${owners.length}`);

    // Find owner IDs that don't exist
    const existingOwnerIds = new Set(owners.map(o => o.id));
    const missingOwnerIds = ownerIds.filter(id => !existingOwnerIds.has(id));

    if (missingOwnerIds.length > 0) {
      console.log(`\n⚠️  Missing owners (referenced but don't exist): ${missingOwnerIds.length}`);
      console.log('Missing owner IDs:', missingOwnerIds);

      // Find fields with missing owners
      const fieldsWithMissingOwners = fields.filter(f => missingOwnerIds.includes(f.ownerId));
      console.log('\nFields with missing owners:');
      fieldsWithMissingOwners.forEach(f => {
        console.log(`  - ID: ${f.id}, Name: ${f.name}, OwnerID: ${f.ownerId}, Bookings: ${f._count.bookings}`);
      });
    } else {
      console.log('\n✅ All owner references are valid!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFieldOwners();
