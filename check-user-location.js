import { PrismaClient } from './lib/generated/prisma/index.js';
const prisma = new PrismaClient();

async function checkUserLocation() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'jmedina@surterreproperties.com' }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User ID:', user.id);
    console.log('Current officeLocation:', user.officeLocation);

    await prisma.$disconnect();
  } catch (err) {
    console.error('Error:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkUserLocation();
