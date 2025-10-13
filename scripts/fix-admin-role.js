import { PrismaClient } from '../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing admin role for jmedina@surterreproperties.com...')

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: 'jmedina@surterreproperties.com' },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  })

  if (!user) {
    console.error('❌ User jmedina@surterreproperties.com not found!')
    process.exit(1)
  }

  console.log(`Found user: ${user.firstName} ${user.lastName} (${user.email})`)
  console.log(`Current roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`)

  // Find the Admin role
  const adminRole = await prisma.role.findFirst({
    where: { name: 'Admin' }
  })

  if (!adminRole) {
    console.error('❌ Admin role not found in database!')
    process.exit(1)
  }

  // Check if user already has Admin role
  const hasAdminRole = user.roles.some(r => r.role.name === 'Admin')

  if (hasAdminRole) {
    console.log('✅ User already has Admin role!')
  } else {
    // Assign Admin role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id
      }
    })
    console.log('✅ Admin role assigned successfully!')
  }

  console.log('\n✅ Done! User should now have full admin access.')
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
