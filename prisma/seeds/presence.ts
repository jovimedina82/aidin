import { PrismaClient } from '../../lib/generated/prisma'

const prisma = new PrismaClient()

export async function seedPresenceModule() {
  console.log('🔄 Seeding Presence Module...')

  // Seed baseline statuses
  const statuses = [
    {
      code: 'AVAILABLE',
      label: 'Available',
      category: 'presence',
      requiresOffice: true,
      color: '#22c55e', // green-500
      icon: 'Check',
      isActive: true,
    },
    {
      code: 'WORKING_REMOTE',
      label: 'Working Remote',
      category: 'presence',
      requiresOffice: false,
      color: '#3b82f6', // blue-500
      icon: 'Home',
      isActive: true,
    },
    {
      code: 'REMOTE',
      label: 'Remote',
      category: 'presence',
      requiresOffice: false,
      color: '#8b5cf6', // violet-500
      icon: 'Laptop',
      isActive: true,
    },
    {
      code: 'VACATION',
      label: 'Vacation',
      category: 'time_off',
      requiresOffice: false,
      color: '#f59e0b', // amber-500
      icon: 'Plane',
      isActive: true,
    },
    {
      code: 'SICK',
      label: 'Sick',
      category: 'time_off',
      requiresOffice: false,
      color: '#ef4444', // red-500
      icon: 'HeartPulse',
      isActive: true,
    },
  ]

  for (const status of statuses) {
    await prisma.presenceStatusType.upsert({
      where: { code: status.code },
      update: {}, // Don't overwrite if exists
      create: status,
    })
  }

  console.log(`✅ Created ${statuses.length} baseline statuses`)

  // Seed baseline office locations
  const offices = [
    {
      code: 'NEWPORT_BEACH',
      name: 'Newport Beach',
      isActive: true,
    },
  ]

  for (const office of offices) {
    await prisma.presenceOfficeLocation.upsert({
      where: { code: office.code },
      update: {}, // Don't overwrite if exists
      create: office,
    })
  }

  console.log(`✅ Created ${offices.length} baseline office locations`)

  console.log('✅ Presence Module seeded successfully')
}

// Run if called directly (ES module check)
if (import.meta.url.endsWith(process.argv[1])) {
  seedPresenceModule()
    .catch((e) => {
      console.error('❌ Error seeding Presence Module:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
