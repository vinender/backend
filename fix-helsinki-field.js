const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixHelsinkiField() {
  try {
    console.log('🔍 Finding valid users...\n');

    // Find all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            ownedFields: true
          }
        }
      }
    });

    console.log(`📊 Total users: ${users.length}\n`);

    // Prefer field owners or admin
    const fieldOwners = users.filter(u => u.role === 'FIELD_OWNER');
    const admins = users.filter(u => u.role === 'ADMIN');

    console.log(`👥 Field owners: ${fieldOwners.length}`);
    console.log(`👥 Admins: ${admins.length}\n`);

    let targetUser = null;

    if (fieldOwners.length > 0) {
      // Use the first field owner
      targetUser = fieldOwners[0];
      console.log(`✅ Selected field owner: ${targetUser.name} (${targetUser.email})`);
      console.log(`   Current fields: ${targetUser._count.ownedFields}\n`);
    } else if (admins.length > 0) {
      // Use the first admin
      targetUser = admins[0];
      console.log(`✅ Selected admin: ${targetUser.name} (${targetUser.email})`);
      console.log(`   Current fields: ${targetUser._count.ownedFields}\n`);
    } else if (users.length > 0) {
      // Use any available user
      targetUser = users[0];
      console.log(`✅ Selected user: ${targetUser.name} (${targetUser.email})`);
      console.log(`   Role: ${targetUser.role}`);
      console.log(`   Current fields: ${targetUser._count.ownedFields}\n`);
    } else {
      console.log('❌ No valid users found in the database!');
      console.log('   Please create at least one user before running this script.');
      return;
    }

    // Update the Helsinki field
    const fieldId = '68ee260160ddfea013b7afb6';

    console.log('🔄 Updating Helsinki Field owner...');

    const updatedField = await prisma.field.update({
      where: { id: fieldId },
      data: {
        ownerId: targetUser.id,
        ownerName: targetUser.name || 'Field Owner'
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`✅ Successfully updated field!`);
    console.log(`   Field: ${updatedField.name}`);
    console.log(`   New Owner: ${updatedField.owner.name} (${updatedField.owner.email})\n`);

    // Verify no more orphaned fields
    console.log('🔍 Verifying all fields have valid owners...');

    const allFields = await prisma.field.findMany({
      select: {
        id: true,
        ownerId: true
      }
    });

    const userIds = new Set(users.map(u => u.id));
    const stillOrphaned = allFields.filter(f => !userIds.has(f.ownerId));

    if (stillOrphaned.length === 0) {
      console.log('✅ All fields now have valid owners!\n');
    } else {
      console.log(`⚠️  Still ${stillOrphaned.length} orphaned fields found.\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixHelsinkiField();
