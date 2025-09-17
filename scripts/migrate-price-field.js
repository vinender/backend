const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateFieldPrices() {
  try {
    console.log('Starting field price migration...');
    
    // Get all fields that have pricePerHour but not price
    const fields = await prisma.field.findMany({
      where: {
        pricePerHour: { not: null }
      }
    });
    
    console.log(`Found ${fields.length} fields to migrate`);
    
    // Update each field
    for (const field of fields) {
      if (field.pricePerHour && !field.price) {
        await prisma.field.update({
          where: { id: field.id },
          data: { 
            price: field.pricePerHour,
            bookingDuration: field.bookingDuration || '1hour'
          }
        });
        console.log(`Updated field ${field.id}: pricePerHour ${field.pricePerHour} -> price ${field.pricePerHour}`);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateFieldPrices();