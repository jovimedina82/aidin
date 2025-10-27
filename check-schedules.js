const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const now = new Date();
  console.log('Current time:', now.toISOString());
  console.log('');

  // Find all schedules
  const schedules = await prisma.staffPresence.findMany({
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { endAt: 'desc' },
    take: 10
  });

  console.log(`Total schedules found: ${schedules.length}`);
  console.log('');

  if (schedules.length === 0) {
    console.log('No schedules in database!');
    await prisma.$disconnect();
    return;
  }

  console.log('Recent schedules:');
  schedules.forEach(s => {
    const isFuture = s.endAt >= now;
    console.log(`${s.user.firstName} ${s.user.lastName} (${s.user.email})`);
    console.log(`  Start: ${s.startAt.toISOString()}`);
    console.log(`  End:   ${s.endAt.toISOString()}`);
    console.log(`  Future? ${isFuture}`);
    console.log('');
  });

  // Check how many users would show up
  const usersWithFutureSchedules = await prisma.user.findMany({
    where: {
      isActive: true,
      staffPresence: {
        some: {
          endAt: {
            gte: now
          }
        }
      }
    },
    select: {
      email: true,
      firstName: true,
      lastName: true
    }
  });

  console.log(`Users with future schedules: ${usersWithFutureSchedules.length}`);
  usersWithFutureSchedules.forEach(u => {
    console.log(`  - ${u.firstName} ${u.lastName} (${u.email})`);
  });

  await prisma.$disconnect();
})();
