import { prisma } from './lib/prisma.js'

async function showSchedules() {
  try {
    const schedules = await prisma.staffPresence.findMany({
      where: {
        userId: '3d575860-da36-4471-a49a-0317755a8a0d'
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    console.log(`\n========================================`)
    console.log(`SCHEDULES FOR: ${schedules[0]?.user.firstName || 'Jovi'} ${schedules[0]?.user.lastName || 'Medina'}`)
    console.log(`========================================\n`)
    console.log(`Total schedules: ${schedules.length}\n`)

    if (schedules.length === 0) {
      console.log('No schedules found.')
    } else {
      schedules.forEach((schedule, i) => {
        console.log(`${i + 1}. Schedule ID: ${schedule.id}`)
        console.log(`   Status: ${schedule.status}`)
        console.log(`   Location: ${schedule.officeLocation || 'N/A'}`)
        console.log(`   Start: ${schedule.startDate}`)
        console.log(`   End: ${schedule.endDate || 'No end date (indefinite)'}`)
        console.log(`   Active: ${schedule.isActive}`)
        console.log(`   Notes: ${schedule.notes || 'None'}`)
        console.log(`   Created: ${schedule.createdAt}`)
        console.log(`   Updated: ${schedule.updatedAt}`)
        console.log()
      })
    }

    const now = new Date()
    const activeSchedules = schedules.filter(s =>
      s.isActive &&
      new Date(s.startDate) <= now &&
      (!s.endDate || new Date(s.endDate) >= now)
    )

    console.log(`\n========================================`)
    console.log(`CURRENTLY ACTIVE SCHEDULES: ${activeSchedules.length}`)
    console.log(`========================================\n`)

    if (activeSchedules.length > 0) {
      activeSchedules.forEach((schedule, i) => {
        console.log(`${i + 1}. ${schedule.status} - ${schedule.officeLocation || 'N/A'}`)
        console.log(`   From: ${schedule.startDate}`)
        console.log(`   To: ${schedule.endDate || 'Indefinite'}`)
        console.log()
      })
    } else {
      console.log('No currently active schedules.')
    }

  } catch (error) {
    console.error('Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

showSchedules()
