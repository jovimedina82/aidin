const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find jmedina user
  const user = await prisma.user.findUnique({
    where: { email: 'jmedina@surterreproperties.com' },
    include: { roles: { include: { role: true } } }
  })
  
  if (!user) {
    console.log('User not found')
    return
  }
  
  console.log('User:', user.email)
  console.log('Current roles:', user.roles.map(r => r.role.name).join(', '))
  
  // Find Staff role
  const staffRole = await prisma.role.findFirst({
    where: { name: 'Staff' }
  })
  
  if (!staffRole) {
    console.log('Staff role not found')
    return
  }
  
  // Check if already has Staff role
  const hasStaffRole = user.roles.some(r => r.roleId === staffRole.id)
  
  if (hasStaffRole) {
    console.log('User already has Staff role')
  } else {
    // Assign Staff role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: staffRole.id
      }
    })
    console.log('✅ Assigned Staff role to user')
  }
  
  // Check presence records
  const presenceCount = await prisma.staffPresence.count({
    where: { userId: user.id }
  })
  console.log(`\nPresence records for this user: ${presenceCount}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
