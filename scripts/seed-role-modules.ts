import { PrismaClient } from '../lib/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding role module defaults...');
  
  // Seed defaults that mirror current behavior so nobody loses access
  const defaults: Record<string, string[]> = {
    requester: ['tickets', 'kb'],
    staff: ['tickets', 'kb', 'presence'],
    manager: ['tickets', 'kb', 'presence', 'reports'],
    admin: ['tickets', 'kb', 'presence', 'reports', 'uploads'],
  };
  
  for (const [role, modules] of Object.entries(defaults)) {
    const result = await prisma.roleModule.upsert({
      where: { role },
      update: { modules },
      create: { role, modules },
    });
    console.log(`  ✅ ${role}: ${modules.join(' , ')}`);
  }
  
  console.log('✨ Role modules seeded successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Error seeding role modules:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
