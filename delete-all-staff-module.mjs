import { prisma } from './lib/prisma.js'

async function deleteAll() {
  try {
    console.log('\n=== DELETING ALL STAFF DIRECTORY DATA ===\n')

    // Delete all staff presence records
    const deletedPresence = await prisma.staffPresence.deleteMany({})
    console.log(`✓ Deleted ${deletedPresence.count} staff presence records`)

    // Delete all office hours
    const deletedOfficeHours = await prisma.officeHours.deleteMany({})
    console.log(`✓ Deleted ${deletedOfficeHours.count} office hours records`)

    console.log('\n=== CLEANUP COMPLETE ===\n')

  } catch (error) {
    console.error('Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

deleteAll()
