import { PrismaClient } from '../lib/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAIUser() {
  try {
    // Check if AI user already exists
    const existing = await prisma.user.findUnique({
      where: { email: 'ai-assistant@surterre.local' }
    })

    if (existing) {
      console.log('✅ AI user already exists:', existing.email)
      console.log('   User ID:', existing.id)
      console.log('   Name:', existing.firstName, existing.lastName)
      return existing
    }

    // Hash a random password (won't be used for login)
    const hashedPassword = await bcrypt.hash('ai-system-account-' + Date.now(), 10)

    // Create AI user
    const aiUser = await prisma.user.create({
      data: {
        email: 'ai-assistant@surterre.local',
        firstName: 'AI',
        lastName: 'Assistant',
        password: hashedPassword,
        isActive: true,
        userType: 'System'
      }
    })

    console.log('✅ Created AI user:', aiUser.email)
    console.log('   User ID:', aiUser.id)
    console.log('   Name:', aiUser.firstName, aiUser.lastName)

    return aiUser
  } catch (error) {
    console.error('❌ Error creating AI user:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createAIUser()
