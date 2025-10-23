import { config } from 'dotenv'
import { PrismaClient } from '../lib/generated/prisma/index.js'

// Load environment variables
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function cleanupConflictingSchedules() {
  console.log('🔍 Finding conflicting schedules...')

  // Get all active staff presences
  const allPresences = await prisma.staffPresence.findMany({
    where: {
      isActive: true
    },
    orderBy: [
      { userId: 'asc' },
      { createdAt: 'desc' }
    ],
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })

  console.log(`📊 Found ${allPresences.length} active schedules`)

  // Group by user
  const userSchedules = {}
  allPresences.forEach(presence => {
    if (!userSchedules[presence.userId]) {
      userSchedules[presence.userId] = []
    }
    userSchedules[presence.userId].push(presence)
  })

  let totalConflicts = 0
  let totalDeactivated = 0

  // Check each user for overlapping schedules
  for (const [userId, schedules] of Object.entries(userSchedules)) {
    if (schedules.length <= 1) continue

    const user = schedules[0].user
    console.log(`\n👤 Checking ${user.firstName} ${user.lastName} (${schedules.length} schedules)`)

    const conflicts = []

    // Check for overlaps
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const schedule1 = schedules[i]
        const schedule2 = schedules[j]

        const start1 = new Date(schedule1.startDate)
        const end1 = schedule1.endDate ? new Date(schedule1.endDate) : null
        const start2 = new Date(schedule2.startDate)
        const end2 = schedule2.endDate ? new Date(schedule2.endDate) : null

        // Check for overlap
        const overlaps = (
          // schedule1 starts during schedule2
          (start1 >= start2 && (!end2 || start1 <= end2)) ||
          // schedule1 ends during schedule2
          (end1 && end1 >= start2 && (!end2 || end1 <= end2)) ||
          // schedule1 completely contains schedule2
          (start1 <= start2 && (!end1 || (end2 && end1 >= end2))) ||
          // schedule2 completely contains schedule1
          (start2 <= start1 && (!end2 || (end1 && end2 >= end1)))
        )

        if (overlaps) {
          conflicts.push({ schedule1, schedule2 })
        }
      }
    }

    if (conflicts.length > 0) {
      totalConflicts += conflicts.length
      console.log(`  ⚠️  Found ${conflicts.length} conflict(s)`)

      // Deactivate older conflicting schedules, keep the most recent
      const toDeactivate = []
      const seen = new Set()

      conflicts.forEach(({ schedule1, schedule2 }) => {
        if (!seen.has(schedule1.id) && !seen.has(schedule2.id)) {
          // Keep the most recently created, deactivate the older one
          const older = new Date(schedule1.createdAt) < new Date(schedule2.createdAt) ? schedule1 : schedule2
          toDeactivate.push(older)
          seen.add(older.id)
        }
      })

      console.log(`  🗑️  Deactivating ${toDeactivate.length} older schedule(s)`)

      for (const schedule of toDeactivate) {
        await prisma.staffPresence.update({
          where: { id: schedule.id },
          data: { isActive: false }
        })
        console.log(`     - Deactivated: ${schedule.status} from ${schedule.startDate}`)
        totalDeactivated++
      }
    }
  }

  console.log(`\n✅ Cleanup complete!`)
  console.log(`   - Total conflicts found: ${totalConflicts}`)
  console.log(`   - Total schedules deactivated: ${totalDeactivated}`)

  await prisma.$disconnect()
}

cleanupConflictingSchedules()
  .catch(error => {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  })
