import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const now = new Date()
console.log('Testing at:', now.toISOString())
const results = await prisma.staffPresence.findMany({
  where: {
    isActive: true,
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
    user: { roles: { some: { role: { name: { in: ['Admin', 'Manager', 'Staff'] } } } } }
  },
  include: { user: { select: { firstName: true, lastName: true } } }
})
console.log('Found', results.length, 'results')
results.forEach(r => console.log(r.user.firstName, r.user.lastName, r.status, r.officeLocation))
await prisma.$disconnect()
