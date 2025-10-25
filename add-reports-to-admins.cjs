const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function addReportsToAdmins() {
  try {
    console.log('🔍 Finding Reports module...');

    // Find the Reports module
    const reportsModule = await prisma.module.findFirst({
      where: { name: 'Reports' }
    });

    if (!reportsModule) {
      console.log('❌ Reports module not found in database');
      return;
    }

    console.log(`✅ Found Reports module (ID: ${reportsModule.id})`);

    // Find all admin users
    console.log('\n🔍 Finding admin users...');
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'ADMIN'
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    console.log(`✅ Found ${adminUsers.length} admin users\n`);

    let added = 0;
    let skipped = 0;

    // Add Reports module to each admin
    for (const user of adminUsers) {
      // Check if user already has Reports access
      const existing = await prisma.userModule.findFirst({
        where: {
          userId: user.id,
          moduleId: reportsModule.id
        }
      });

      if (existing) {
        console.log(`⏭️  ${user.name || user.email} - Already has Reports access`);
        skipped++;
      } else {
        await prisma.userModule.create({
          data: {
            userId: user.id,
            moduleId: reportsModule.id,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true
          }
        });
        console.log(`✅ ${user.name || user.email} - Added Reports access`);
        added++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Total admins: ${adminUsers.length}`);
    console.log(`   - Added access: ${added}`);
    console.log(`   - Already had access: ${skipped}`);
    console.log(`\n✅ Done!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

addReportsToAdmins();
