const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixOrphanedBookings() {
  try {
    console.log('🔍 Finding bookings with orphaned fields...');
    
    // Find all bookings
    const allBookings = await prisma.booking.findMany({
      select: {
        id: true,
        fieldId: true,
      }
    });
    
    console.log(`📊 Total bookings: ${allBookings.length}`);
    
    // Find all fields
    const allFields = await prisma.field.findMany({
      select: {
        id: true,
        ownerId: true,
      }
    });
    
    const fieldMap = new Map(allFields.map(f => [f.id, f.ownerId]));
    
    // Find bookings with null owner IDs
    const orphanedBookings = allBookings.filter(booking => {
      const ownerId = fieldMap.get(booking.fieldId);
      return ownerId === null || ownerId === undefined;
    });
    
    console.log(`⚠️  Found ${orphanedBookings.length} bookings with null/missing field owners`);
    
    if (orphanedBookings.length > 0) {
      console.log('\n🗑️  Deleting orphaned bookings...');
      
      const deleteResult = await prisma.booking.deleteMany({
        where: {
          id: {
            in: orphanedBookings.map(b => b.id)
          }
        }
      });
      
      console.log(`✅ Deleted ${deleteResult.count} orphaned bookings`);
    } else {
      console.log('✅ No orphaned bookings found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedBookings();
