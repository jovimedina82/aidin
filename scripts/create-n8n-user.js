import { PrismaClient } from '../lib/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

async function createN8nUser() {
  const prisma = new PrismaClient()

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'n8n-api@helpdesk.local' }
    })

    if (existingUser) {
      console.log('N8N API user already exists:', existingUser.email)
      console.log('Credentials:')
      console.log('Email:', existingUser.email)
      console.log('Password: n8n123api')
      return
    }

    // Create N8N API user
    const hashedPassword = await bcrypt.hash('n8n123api', 12)

    const user = await prisma.user.create({
      data: {
        email: 'n8n-api@helpdesk.local',
        password: hashedPassword,
        firstName: 'N8N',
        lastName: 'API User',
        userType: 'Staff',
        isActive: true
      }
    })

    // Get or create Staff role
    let staffRole = await prisma.role.findFirst({
      where: { name: 'Staff' }
    })

    if (!staffRole) {
      staffRole = await prisma.role.create({
        data: {
          name: 'Staff',
          description: 'Staff member role',
          permissions: JSON.stringify(['read:tickets', 'write:tickets', 'read:users'])
        }
      })
    }

    // Assign Staff role to N8N user
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: staffRole.id
      }
    })

    console.log('✅ N8N API user created successfully!')
    console.log('Email:', user.email)
    console.log('Password: n8n123api')
    console.log('Role: Staff')

  } catch (error) {
    console.error('Error creating N8N user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createN8nUser()