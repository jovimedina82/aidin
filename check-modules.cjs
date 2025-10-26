const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== CHECKING MODULES ===\n')
  
  // 1. Check if reports module exists
  const reportsModule = await prisma.module.findUnique({
    where: { key: 'reports' }
  })
  
  if (!reportsModule) {
    console.log('❌ Reports module NOT FOUND in database')
  } else {
    console.log('✅ Reports module found:')
    console.log('   ID:', reportsModule.id)
    console.log('   Name:', reportsModule.name)
    console.log('   Key:', reportsModule.key)
    console.log('   Active:', reportsModule.isActive)
    console.log('   Core:', reportsModule.isCore)
  }
  
  // 2. Check Admin role
  const adminRole = await prisma.role.findFirst({
    where: { name: 'Admin' }
  })
  
  if (!adminRole) {
    console.log('\n❌ Admin role NOT FOUND')
  } else {
    console.log('\n✅ Admin role found:', adminRole.id)
  }
  
  // 3. Check role-module access for Admin -> Reports
  if (reportsModule && adminRole) {
    const access = await prisma.roleModuleAccess.findUnique({
      where: {
        roleId_moduleId: {
          roleId: adminRole.id,
          moduleId: reportsModule.id
        }
      }
    })
    
    if (!access) {
      console.log('\n❌ Admin does NOT have access to Reports module')
      console.log('   Creating access now...')
      
      await prisma.roleModuleAccess.create({
        data: {
          roleId: adminRole.id,
          moduleId: reportsModule.id,
          hasAccess: true
        }
      })
      
      console.log('   ✅ Access granted!')
    } else {
      console.log('\n✅ Admin has access to Reports:', access.hasAccess)
    }
  }
  
  // 4. Check jmedina user
  const user = await prisma.user.findUnique({
    where: { email: 'jmedina@surterreproperties.com' },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  })
  
  if (user) {
    console.log('\n✅ User jmedina@surterreproperties.com found')
    console.log('   Roles:', user.roles.map(r => r.role.name).join(', '))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
