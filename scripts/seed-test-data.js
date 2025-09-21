import { PrismaClient } from '../lib/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Test data arrays
const agentNames = [
  { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@surterreproperties.com' },
  { firstName: 'Mike', lastName: 'Chen', email: 'mike.chen@surterreproperties.com' },
  { firstName: 'Emily', lastName: 'Rodriguez', email: 'emily.rodriguez@surterreproperties.com' }
]

const requesterNames = [
  { firstName: 'David', lastName: 'Wilson', email: 'david.wilson@surterreproperties.com' },
  { firstName: 'Lisa', lastName: 'Anderson', email: 'lisa.anderson@surterreproperties.com' },
  { firstName: 'Robert', lastName: 'Martinez', email: 'robert.martinez@surterreproperties.com' },
  { firstName: 'Jennifer', lastName: 'Taylor', email: 'jennifer.taylor@surterreproperties.com' },
  { firstName: 'Chris', lastName: 'Brown', email: 'chris.brown@surterreproperties.com' }
]

const ticketTemplates = [
  { title: 'Computer running slow', category: 'Hardware Problem', description: 'My computer has been running very slowly lately, especially when opening multiple applications.' },
  { title: 'Cannot access email account', category: 'Account Access', description: 'I am unable to log into my email account. Getting authentication error.' },
  { title: 'Printer not working', category: 'Hardware Problem', description: 'Office printer is not responding and showing error lights.' },
  { title: 'VPN connection issues', category: 'Network Problem', description: 'Cannot connect to company VPN from home office.' },
  { title: 'Software installation request', category: 'Software Request', description: 'Need Adobe Acrobat Pro installed on my workstation.' },
  { title: 'Forgot password', category: 'Account Access', description: 'I forgot my domain password and need it reset.' },
  { title: 'Monitor not displaying', category: 'Hardware Problem', description: 'External monitor is not displaying anything when connected.' },
  { title: 'Internet connection down', category: 'Network Problem', description: 'No internet connectivity in the east wing of the building.' },
  { title: 'Phone not working', category: 'Hardware Problem', description: 'Desk phone is not receiving or making calls.' },
  { title: 'File server access', category: 'Account Access', description: 'Cannot access shared files on the company server.' },
  { title: 'Antivirus alert', category: 'Security Issue', description: 'Getting multiple antivirus warnings on my computer.' },
  { title: 'Backup not running', category: 'System Issue', description: 'Automated backup system seems to have stopped working.' },
  { title: 'New employee setup', category: 'Account Access', description: 'Need to set up accounts and access for new team member.' },
  { title: 'Keyboard malfunction', category: 'Hardware Problem', description: 'Several keys on my keyboard are not working properly.' },
  { title: 'Application crash', category: 'Software Issue', description: 'Excel keeps crashing when opening large spreadsheets.' },
  { title: 'Wifi connectivity', category: 'Network Problem', description: 'Cannot connect to office wifi network.' },
  { title: 'Projector setup', category: 'Hardware Problem', description: 'Need help setting up projector for presentation.' },
  { title: 'Database access error', category: 'Account Access', description: 'Getting permission denied error when accessing customer database.' },
  { title: 'Spam email issues', category: 'Email Issue', description: 'Receiving excessive spam emails in my inbox.' },
  { title: 'Mobile device sync', category: 'Mobile Support', description: 'Company email not syncing properly on my mobile device.' }
]

const statuses = ['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED']
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

// Helper function to get random item from array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)]
}

// Helper function to generate random date within last 30 days
function getRandomDate() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
  const randomTime = thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime())
  return new Date(randomTime)
}

async function main() {
  console.log('🚀 Starting test data generation...')

  try {
    // Get existing roles
    const agentRole = await prisma.role.findFirst({ where: { name: 'Agent' } })
    const requesterRole = await prisma.role.findFirst({ where: { name: 'Requester' } })

    if (!agentRole || !requesterRole) {
      throw new Error('Required roles (Agent, Requester) not found in database')
    }

    // Create agents
    console.log('👥 Creating 3 agents...')
    const agents = []
    for (const agent of agentNames) {
      // Check if user already exists
      let existingAgent = await prisma.user.findUnique({
        where: { email: agent.email },
        include: { roles: true }
      })

      if (existingAgent) {
        agents.push(existingAgent)
        console.log(`♻️  Using existing agent: ${agent.firstName} ${agent.lastName}`)
      } else {
        const hashedPassword = await bcrypt.hash('password123', 10)
        const createdAgent = await prisma.user.create({
          data: {
            email: agent.email,
            password: hashedPassword,
            firstName: agent.firstName,
            lastName: agent.lastName,
            isActive: true,
            roles: {
              create: {
                roleId: agentRole.id
              }
            }
          }
        })
        agents.push(createdAgent)
        console.log(`✅ Created agent: ${agent.firstName} ${agent.lastName}`)
      }
    }

    // Create requesters
    console.log('🙋 Creating 5 requesters...')
    const requesters = []
    for (const requester of requesterNames) {
      // Check if user already exists
      let existingRequester = await prisma.user.findUnique({
        where: { email: requester.email },
        include: { roles: true }
      })

      if (existingRequester) {
        requesters.push(existingRequester)
        console.log(`♻️  Using existing requester: ${requester.firstName} ${requester.lastName}`)
      } else {
        const hashedPassword = await bcrypt.hash('password123', 10)
        const createdRequester = await prisma.user.create({
          data: {
            email: requester.email,
            password: hashedPassword,
            firstName: requester.firstName,
            lastName: requester.lastName,
            isActive: true,
            roles: {
              create: {
                roleId: requesterRole.id
              }
            }
          }
        })
        requesters.push(createdRequester)
        console.log(`✅ Created requester: ${requester.firstName} ${requester.lastName}`)
      }
    }

    // Create 30 random tickets
    console.log('🎫 Creating 30 random tickets...')

    // Get the highest existing ticket number to avoid conflicts
    const existingTickets = await prisma.ticket.findMany({
      select: { ticketNumber: true },
      orderBy: { ticketNumber: 'desc' },
      take: 1
    })

    let startNumber = 2000 // Start from 2000 to avoid conflicts
    if (existingTickets.length > 0) {
      const lastTicketNum = existingTickets[0].ticketNumber
      const match = lastTicketNum.match(/TICK-(\d+)/)
      if (match) {
        startNumber = Math.max(startNumber, parseInt(match[1]) + 1)
      }
    }

    for (let i = 1; i <= 30; i++) {
      const template = getRandomItem(ticketTemplates)
      const requester = getRandomItem(requesters)
      const assignee = Math.random() > 0.3 ? getRandomItem(agents) : null // 70% chance of being assigned
      const status = getRandomItem(statuses)
      const priority = getRandomItem(priorities)
      const createdAt = getRandomDate()

      // Generate unique ticket number
      const ticketNumber = `TICK-${startNumber + i}`

      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          title: template.title,
          description: template.description,
          category: template.category,
          priority,
          status,
          requesterId: requester.id,
          assigneeId: assignee?.id,
          createdAt,
          updatedAt: new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime()))
        }
      })

      console.log(`✅ Created ticket ${i}/30: ${ticketNumber} - ${template.title} (${status})`)
    }

    console.log('🎉 Test data generation completed successfully!')
    console.log(`
📊 Summary:
- Created 3 agents
- Created 5 requesters
- Created 30 tickets
- All users have password: password123

🔐 Agent logins:
- sarah.johnson@surterreproperties.com
- mike.chen@surterreproperties.com
- emily.rodriguez@surterreproperties.com

👤 Requester logins:
- david.wilson@surterreproperties.com
- lisa.anderson@surterreproperties.com
- robert.martinez@surterreproperties.com
- jennifer.taylor@surterreproperties.com
- chris.brown@surterreproperties.com
    `)

  } catch (error) {
    console.error('❌ Error generating test data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()