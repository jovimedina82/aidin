// Debug script to check presence data
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('=== PRESENCE DEBUG ===\n')

  // 1. Check all presence records
  const allPresence = await prisma.staffPresence.findMany({
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          roles: {
            include: {
              role: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  console.log(`Total presence records (last 5): ${allPresence.length}`)
  allPresence.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.user.firstName} ${p.user.lastName} (${p.user.email})`)
    console.log(`   Status: ${p.status}`)
    console.log(`   Location: ${p.officeLocation || 'N/A'}`)
    console.log(`   Active: ${p.isActive}`)
    console.log(`   Start: ${p.startDate}`)
    console.log(`   End: ${p.endDate || 'No end date'}`)
    console.log(`   Roles: ${p.user.roles.map(r => r.role?.name || 'unknown').join(', ')}`)
  })

  // 2. Check what the API query would return
  const now = new Date()
  const apiPresence = await prisma.staffPresence.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gte: now } }
      ],
      user: {
        roles: {
          some: {
            role: {
              name: {
                in: ['Admin', 'Manager', 'Staff']
              }
            }
          }
        }
      }
    },
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  })

  console.log(`\n\n=== API WOULD RETURN ===`)
  console.log(`Count: ${apiPresence.length}`)
  apiPresence.forEach((p, i) => {
    console.log(`${i + 1}. ${p.user.firstName} ${p.user.lastName} - ${p.status}`)
  })

  console.log(`\n\nCurrent time: ${now.toISOString()}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
