import { PrismaClient } from './lib/generated/prisma/index.js';
const prisma = new PrismaClient();

async function deleteAllSchedules() {
  try {
    // Delete all active staff presence records
    const deleted = await prisma.staffPresence.updateMany({
      where: {
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    console.log(`Deleted ${deleted.count} active staff presence schedules`);

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteAllSchedules();
