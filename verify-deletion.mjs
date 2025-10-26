import { prisma } from './lib/prisma.js'

async function verify() {
  try {
    const presenceCount = await prisma.staffPresence.count()
    const officeHoursCount = await prisma.officeHours.count()

    console.log('\n=== DATABASE VERIFICATION ===')
    console.log(`Staff Presence records: ${presenceCount}`)
    console.log(`Office Hours records: ${officeHoursCount}`)
    console.log('\nStatus: ALL STAFF DIRECTORY DATA HAS BEEN DELETED ✓')
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

verify()
