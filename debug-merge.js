import { PrismaClient } from './lib/generated/prisma/index.js';
const prisma = new PrismaClient();

async function debugMerge() {
  try {
    // Get your user ID
    const user = await prisma.user.findFirst({
      where: { email: 'jmedina@surterreproperties.com' }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User ID:', user.id);

    // Get all active presences
    const presences = await prisma.staffPresence.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      orderBy: { startDate: 'asc' }
    });

    console.log('\nActive Presences:');
    presences.forEach((p, i) => {
      console.log(`\n${i + 1}. Status: ${p.status}`);
      console.log(`   Location: ${p.officeLocation}`);
      console.log(`   Start: ${p.startDate}`);
      console.log(`   End: ${p.endDate}`);
      console.log(`   Created: ${p.createdAt}`);
    });

    // Get office hours
    const officeHours = await prisma.officeHours.findMany({
      where: {
        userId: user.id,
        isActive: true
      }
    });

    console.log('\nOffice Hours:');
    officeHours.forEach(oh => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      console.log(`${days[oh.dayOfWeek]}: ${oh.startTime} - ${oh.endTime}`);
    });

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

debugMerge();
