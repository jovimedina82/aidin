import { config } from 'dotenv'
import { PrismaClient } from '../lib/generated/prisma/index.js'

// Load environment variables
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function findAllSchedules() {
  console.log('🔍 Finding all of Jovi Medina\'s active schedules that cover Oct 21...')

  // Find Jovi Medina's user
  const user = await prisma.user.findFirst({
    where: {
      email: 'jmedina@surterreproperties.com'
    }
  })

  if (!user) {
    console.log('❌ User not found')
    return
  }

  console.log(`✅ Found user: ${user.firstName} ${user.lastName}`)

  // Oct 21, 2025
  const oct21Start = new Date('2025-10-21T00:00:00')
  const oct21End = new Date('2025-10-21T23:59:59')

  // Find all active schedules that overlap with Oct 21
  const schedules = await prisma.staffPresence.findMany({
    where: {
      userId: user.id,
      isActive: true,
      startDate: { lte: oct21End },
      OR: [
        { endDate: null },
        { endDate: { gte: oct21Start } }
      ]
    },
    orderBy: {
      startDate: 'asc'
    }
  })

  console.log(`\n📊 Found ${schedules.length} active schedule(s) that cover Oct 21:`)

  schedules.forEach((schedule, index) => {
    const start = new Date(schedule.startDate)
    const end = schedule.endDate ? new Date(schedule.endDate) : null
    console.log(`\n  ${index + 1}. ID: ${schedule.id}`)
    console.log(`     Status: ${schedule.status}`)
    console.log(`     Location: ${schedule.officeLocation || 'N/A'}`)
    console.log(`     From: ${start.toLocaleString()}`)
    console.log(`     To: ${end ? end.toLocaleString() : 'No end date (indefinite)'}`)
    console.log(`     Notes: ${schedule.notes || 'None'}`)
    console.log(`     Created: ${schedule.createdAt.toLocaleString()}`)
  })

  await prisma.$disconnect()
}

findAllSchedules()
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
