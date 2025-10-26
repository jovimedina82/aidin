import { prisma } from './lib/prisma.js'

async function testWeekView() {
  try {
    const userId = '3d575860-da36-4471-a49a-0317755a8a0d'

    console.log('\n=== TESTING WEEK VIEW LOGIC ===\n')

    // Fetch all presences for this user
    const presences = await prisma.staffPresence.findMany({
      where: {
        userId,
        isActive: true
      },
      orderBy: { startDate: 'asc' }
    })

    console.log(`Found ${presences.length} active presences\n`)

    presences.forEach((p, i) => {
      console.log(`${i + 1}. ${p.status} - ${p.officeLocation}`)
      console.log(`   Start: ${p.startDate}`)
      console.log(`   End: ${p.endDate || 'null'}`)
    })

    // Test the filter logic for today
    const now = new Date()
    console.log(`\n=== TESTING FOR TODAY ===`)
    console.log(`Current time: ${now.toISOString()}\n`)

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(now)
      currentDate.setDate(now.getDate() + i)
      currentDate.setHours(0, 0, 0, 0)

      console.log(`\n--- Day ${i}: ${currentDate.toISOString().split('T')[0]} ---`)

      const daySchedules = presences.filter(p => {
        const startDate = new Date(p.startDate)
        const endDate = p.endDate ? new Date(p.endDate) : null

        const dayStart = new Date(currentDate)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(currentDate)
        dayEnd.setHours(23, 59, 59, 999)

        const overlaps = startDate <= dayEnd && (endDate === null || endDate > dayStart)

        console.log(`  Checking schedule ${p.id.substring(0, 8)}...`)
        console.log(`    Schedule: ${startDate.toISOString()} to ${endDate?.toISOString() || 'null'}`)
        console.log(`    Day range: ${dayStart.toISOString()} to ${dayEnd.toISOString()}`)
        console.log(`    startDate <= dayEnd: ${startDate <= dayEnd}`)
        console.log(`    endDate > dayStart: ${endDate === null || endDate > dayStart}`)
        console.log(`    Overlaps: ${overlaps}`)

        return overlaps
      })

      console.log(`  Result: ${daySchedules.length} schedules for this day`)
    }

  } catch (error) {
    console.error('Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testWeekView()
