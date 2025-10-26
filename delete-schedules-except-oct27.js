import { PrismaClient } from './lib/generated/prisma/index.js';

const prisma = new PrismaClient();

async function deleteSchedulesExceptOct27() {
  try {
    // October 27, 2025 in UTC
    const oct27Start = new Date('2025-10-27T00:00:00.000Z');
    const oct27End = new Date('2025-10-27T23:59:59.999Z');

    console.log('Looking for schedules to delete (all except Oct 27)...');

    // Find all active schedules
    const allSchedules = await prisma.staffPresence.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        userId: true,
        startDate: true,
        endDate: true,
        status: true,
        officeLocation: true
      }
    });

    console.log(`Found ${allSchedules.length} total active schedules`);

    // Filter to find schedules that are NOT for Oct 27
    const schedulesToDelete = allSchedules.filter(schedule => {
      const startDate = new Date(schedule.startDate);
      const endDate = schedule.endDate ? new Date(schedule.endDate) : null;

      // Keep only schedules that start on Oct 27
      const startsOnOct27 = startDate >= oct27Start && startDate <= oct27End;

      // If it starts on Oct 27, keep it (don't delete)
      if (startsOnOct27) {
        console.log('Keeping schedule:', schedule.id, 'starts:', startDate.toISOString());
        return false;
      }

      // Otherwise, mark for deletion
      console.log('Will delete schedule:', schedule.id, 'starts:', startDate.toISOString());
      return true;
    });

    console.log(`\nDeleting ${schedulesToDelete.length} schedules...`);

    // Delete them
    const deleted = await prisma.staffPresence.updateMany({
      where: {
        id: {
          in: schedulesToDelete.map(s => s.id)
        }
      },
      data: {
        isActive: false
      }
    });

    console.log(`✓ Deleted ${deleted.count} schedules (kept Oct 27 schedules)`);

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteSchedulesExceptOct27();
