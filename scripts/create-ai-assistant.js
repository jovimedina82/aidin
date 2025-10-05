import { prisma } from '../lib/prisma.js'
import bcrypt from 'bcryptjs'

async function createAIAssistant() {
  try {
    // Check if AI assistant already exists
    const existing = await prisma.user.findFirst({
      where: {
        email: 'ai-assistant@surterre.local'
      }
    })

    if (existing) {
      console.log('✅ AI Assistant user already exists:', existing.email)
      return existing
    }

    // Create AI assistant user
    const hashedPassword = await bcrypt.hash('ai-assistant-secure-password', 10)

    const aiAssistant = await prisma.user.create({
      data: {
        email: 'ai-assistant@surterre.local',
        password: hashedPassword,
        firstName: 'AidIN',
        lastName: 'Assistant',
        userType: 'STAFF',
        isActive: true
      }
    })

    console.log('✅ AI Assistant user created successfully!')
    console.log('   ID:', aiAssistant.id)
    console.log('   Email:', aiAssistant.email)
    console.log('   Name:', aiAssistant.firstName, aiAssistant.lastName)

    return aiAssistant
  } catch (error) {
    console.error('❌ Error creating AI assistant:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createAIAssistant()
