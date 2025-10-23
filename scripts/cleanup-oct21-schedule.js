import { config } from 'dotenv'
import { PrismaClient } from '../lib/generated/prisma/index.js'

// Load environment variables
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function cleanupOverlappingSchedule() {
  console.log('🔍 Finding Jovi Medina\'s Oct 21 schedules...')

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

  // Find all active schedules for Oct 21, 2025
  const oct21Start = new Date('2025-10-21T00:00:00')
  const oct21End = new Date('2025-10-21T23:59:59')

  const schedules = await prisma.staffPresence.findMany({
    where: {
      userId: user.id,
      isActive: true,
      startDate: {
        gte: oct21Start,
        lte: oct21End
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  console.log(`\n📊 Found ${schedules.length} active schedule(s) for Oct 21:`)

  schedules.forEach((schedule, index) => {
    const start = new Date(schedule.startDate)
    const end = schedule.endDate ? new Date(schedule.endDate) : null
    console.log(`  ${index + 1}. ${schedule.status} - ${schedule.officeLocation || 'N/A'}`)
    console.log(`     From: ${start.toLocaleString()}`)
    console.log(`     To: ${end ? end.toLocaleString() : 'No end date'}`)
    console.log(`     Created: ${schedule.createdAt.toLocaleString()}`)
  })

  // Deactivate the old full-day Newport schedule (the first/oldest one that covers 9-5)
  const fullDaySchedule = schedules.find(s => {
    const start = new Date(s.startDate)
    const end = s.endDate ? new Date(s.endDate) : null

    // Check if this is a full-day or near-full-day schedule (9am-5pm)
    const startHour = start.getHours()
    const endHour = end ? end.getHours() : null

    return startHour === 9 && endHour === 17 && s.officeLocation === 'NEWPORT'
  })

  if (fullDaySchedule) {
    console.log(`\n🗑️  Deactivating old full-day Newport schedule...`)
    await prisma.staffPresence.update({
      where: { id: fullDaySchedule.id },
      data: { isActive: false }
    })
    console.log(`✅ Deactivated old schedule`)
  } else {
    console.log(`\n⚠️  No full-day Newport schedule found to deactivate`)
  }

  console.log(`\n✅ Cleanup complete!`)

  await prisma.$disconnect()
}

cleanupOverlappingSchedule()
  .catch(error => {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  })
