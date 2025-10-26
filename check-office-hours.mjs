import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  try {
    const officeHours = await prisma.officeHours.findMany({
      where: { userId: '3d575860-da36-4471-a49a-0317755a8a0d' }
    })

    console.log(`Found ${officeHours.length} office hours:`)
    officeHours.forEach((oh, i) => {
      console.log(`${i + 1}. Day ${oh.dayOfWeek}: ${oh.startTime} - ${oh.endTime}, Active: ${oh.isActive}`)
    })
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

check()
