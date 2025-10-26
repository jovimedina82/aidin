const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.staffPresence.count()
  console.log('Total presence records:', count)
  
  const recent = await prisma.staffPresence.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          roles: {
            include: {
              role: { select: { name: true } }
            }
          }
        }
      }
    }
  })
  
  console.log('\nRecent records:')
  recent.forEach((p, i) => {
    console.log(`${i+1}. ${p.user.email} - ${p.status} (active: ${p.isActive})`)
    console.log(`   Roles: ${p.user.roles.map(r => r.role.name).join(', ')}`)
    console.log(`   Start: ${p.startDate}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
