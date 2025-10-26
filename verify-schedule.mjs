import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verify() {
  try {
    const now = new Date()
    console.log('Current server time:', now.toISOString())

    const schedule = await prisma.staffPresence.findUnique({
      where: { id: '2c8bae3b-73e2-4ff8-a8be-56d5099b8505' },
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

    if (schedule) {
      console.log('\nSchedule found:')
      console.log('  User:', `${schedule.user.firstName} ${schedule.user.lastName}`)
      console.log('  Status:', schedule.status)
      console.log('  Location:', schedule.officeLocation)
      console.log('  Start:', schedule.startDate)
      console.log('  End:', schedule.endDate)
      console.log('  Active:', schedule.isActive)
      console.log('\nTime checks:')
      console.log('  Has started?', new Date(schedule.startDate) <= now)
      console.log('  Has ended?', schedule.endDate && new Date(schedule.endDate) < now)
      console.log('  Should show?', new Date(schedule.startDate) <= now && (!schedule.endDate || new Date(schedule.endDate) >= now))
    } else {
      console.log('Schedule NOT found!')
    }
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

verify()
