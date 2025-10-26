const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function check() {
  const modules = await prisma.module.findMany({
    orderBy: { name: 'asc' }
  });
  
  console.log('\n=== ALL MODULES ===');
  modules.forEach(m => {
    console.log('- ' + m.name + ' (key: ' + m.key + ', core: ' + m.isCore + ')');
  });
  
  const adminRole = await prisma.role.findUnique({
    where: { name: 'Admin' },
    include: {
      moduleAccess: {
        include: { module: true }
      }
    }
  });
  
  console.log('\n=== ADMIN ROLE MODULE ACCESS ===');
  if (adminRole) {
    console.log('Modules with access:');
    adminRole.moduleAccess.forEach(ma => {
      console.log('- ' + ma.module.name + ' (has_access: ' + ma.hasAccess + ')');
    });
  }
  
  const adminModuleIds = adminRole?.moduleAccess.map(ma => ma.moduleId) || [];
  const missingModules = modules.filter(m => !adminModuleIds.includes(m.id));
  
  console.log('\n=== MODULES ADMIN MISSING ===');
  missingModules.forEach(m => {
    console.log('- ' + m.name + ' (key: ' + m.key + ')');
  });
  
  await prisma.$disconnect();
}

check().catch(console.error);
