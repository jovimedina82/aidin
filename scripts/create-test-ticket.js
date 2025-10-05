import { PrismaClient } from '../lib/generated/prisma/index.js'

async function createTestTicket() {
  const prisma = new PrismaClient()

  try {
    // Find the N8N user we created
    const n8nUser = await prisma.user.findUnique({
      where: { email: 'n8n-api@helpdesk.local' }
    })

    if (!n8nUser) {
      console.error('N8N user not found. Run the create-n8n-user script first.')
      return
    }

    // Create a test ticket
    const ticketNumber = `TEST-${Date.now()}`

    const testTicket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title: 'N8N Integration Test Ticket',
        description: 'This is a test ticket created to verify N8N webhook integration is working properly. It should trigger the N8N workflow automatically.',
        status: 'NEW',
        priority: 'HIGH', // HIGH priority to test the alert workflow
        category: 'Password Issues',
        requesterId: n8nUser.id,
        assigneeId: null
      }
    })

    console.log('✅ Test ticket created successfully!')
    console.log('Ticket Number:', testTicket.ticketNumber)
    console.log('Ticket ID:', testTicket.id)
    console.log('Priority:', testTicket.priority)
    console.log('')
    console.log('This should trigger the N8N webhook if the workflow is active.')
    console.log('Check N8N executions at: http://localhost:5678')

    return testTicket

  } catch (error) {
    console.error('Error creating test ticket:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestTicket()