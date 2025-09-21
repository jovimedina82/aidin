import { PrismaClient } from '../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

// Additional ticket templates for variety
const additionalTicketTemplates = [
  {
    title: 'Laptop Screen Flickering',
    description: 'My laptop screen keeps flickering when I open certain applications. It makes it difficult to work.',
    category: 'Hardware',
    priority: 'HIGH'
  },
  {
    title: 'Wi-Fi Connection Dropping',
    description: 'Wi-Fi connection keeps dropping every few minutes. Need stable connection for video calls.',
    category: 'Network',
    priority: 'HIGH'
  },
  {
    title: 'Unable to Access Shared Drive',
    description: 'Cannot access the shared company drive. Getting permission denied error.',
    category: 'Access Request',
    priority: 'NORMAL'
  },
  {
    title: 'Microsoft Teams Audio Issues',
    description: 'Cannot hear other participants in Teams meetings. Audio settings appear correct.',
    category: 'Software',
    priority: 'HIGH'
  },
  {
    title: 'Password Reset Request',
    description: 'Need to reset my password for the accounting system. Current password expired.',
    category: 'Access Request',
    priority: 'NORMAL'
  },
  {
    title: 'Printer Jam Error',
    description: 'Office printer shows paper jam error but no paper visible. Need assistance.',
    category: 'Hardware',
    priority: 'NORMAL'
  },
  {
    title: 'Email Not Syncing',
    description: 'Emails are not syncing to my mobile device. Desktop Outlook works fine.',
    category: 'Email',
    priority: 'NORMAL'
  },
  {
    title: 'Software Installation Request',
    description: 'Need Adobe Acrobat Pro installed on my workstation for PDF editing.',
    category: 'Software',
    priority: 'NORMAL'
  },
  {
    title: 'VPN Connection Failed',
    description: 'Cannot connect to company VPN from home. Authentication keeps failing.',
    category: 'Security',
    priority: 'HIGH'
  },
  {
    title: 'Database Query Running Slow',
    description: 'Monthly reports taking too long to generate. Database queries timing out.',
    category: 'Database',
    priority: 'HIGH'
  },
  {
    title: 'New Employee Account Setup',
    description: 'Need to create accounts and access for new hire starting Monday.',
    category: 'Access Request',
    priority: 'URGENT'
  },
  {
    title: 'Backup System Alert',
    description: 'Received alert that backup system failed last night. Need investigation.',
    category: 'Infrastructure',
    priority: 'URGENT'
  },
  {
    title: 'Website Loading Slowly',
    description: 'Company website taking long time to load. Customers complaining.',
    category: 'Website',
    priority: 'HIGH'
  },
  {
    title: 'Excel Macro Not Working',
    description: 'Custom Excel macro stopped working after Windows update.',
    category: 'Software',
    priority: 'NORMAL'
  },
  {
    title: 'Phone Extension Not Working',
    description: 'Office phone extension not receiving calls. Direct line works fine.',
    category: 'Communication',
    priority: 'NORMAL'
  },
  {
    title: 'Security Camera Offline',
    description: 'Security camera in parking lot showing offline. Need immediate attention.',
    category: 'Security',
    priority: 'HIGH'
  },
  {
    title: 'File Sharing Permission Issue',
    description: 'Cannot share files with external clients. Getting security policy error.',
    category: 'Security',
    priority: 'NORMAL'
  },
  {
    title: 'Antivirus Software Update',
    description: 'Antivirus software showing outdated definitions. Auto-update not working.',
    category: 'Security',
    priority: 'HIGH'
  },
  {
    title: 'Mobile Device Setup',
    description: 'Need help setting up new company mobile device with email and apps.',
    category: 'Mobile',
    priority: 'NORMAL'
  },
  {
    title: 'Cloud Storage Space Issue',
    description: 'Running out of cloud storage space. Need to increase quota.',
    category: 'Storage',
    priority: 'NORMAL'
  },
  {
    title: 'Conference Room Tech Setup',
    description: 'Conference room projector not connecting to laptops. Important meeting today.',
    category: 'Hardware',
    priority: 'URGENT'
  },
  {
    title: 'Keyboard Keys Sticking',
    description: 'Several keys on keyboard are sticking. Affecting typing speed.',
    category: 'Hardware',
    priority: 'LOW'
  },
  {
    title: 'Monitor Resolution Issue',
    description: 'External monitor not displaying at full resolution. Text appears blurry.',
    category: 'Hardware',
    priority: 'NORMAL'
  },
  {
    title: 'Internet Speed Slow',
    description: 'Internet connection very slow today. Web pages taking forever to load.',
    category: 'Network',
    priority: 'HIGH'
  },
  {
    title: 'Software License Expired',
    description: 'Design software license expired. Cannot open project files.',
    category: 'Software',
    priority: 'HIGH'
  },
  {
    title: 'Two-Factor Authentication Setup',
    description: 'Need help setting up 2FA for better account security.',
    category: 'Security',
    priority: 'NORMAL'
  },
  {
    title: 'Data Recovery Request',
    description: 'Accidentally deleted important files. Need data recovery assistance.',
    category: 'Data Recovery',
    priority: 'URGENT'
  },
  {
    title: 'Browser Keeps Crashing',
    description: 'Chrome browser crashes when opening certain websites. Very frustrating.',
    category: 'Software',
    priority: 'NORMAL'
  },
  {
    title: 'USB Port Not Working',
    description: 'Front USB ports on computer not working. Cannot connect devices.',
    category: 'Hardware',
    priority: 'NORMAL'
  },
  {
    title: 'Calendar Sync Issues',
    description: 'Calendar appointments not syncing between phone and computer.',
    category: 'Software',
    priority: 'NORMAL'
  }
]

const ticketStatuses = ['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED']
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

async function createAdditionalTickets() {
  console.log('🎫 Creating 50 additional tickets with random assignments...')

  try {
    // Get current ticket count to avoid conflicts
    const existingTicketCount = await prisma.ticket.count()
    console.log(`Found ${existingTicketCount} existing tickets`)

    // Get all users
    const users = await prisma.user.findMany({
      include: {
        departments: {
          include: {
            department: true
          }
        },
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    // Get potential assignees (IT staff, managers, admins)
    const assignees = users.filter(user =>
      user.departments.some(ud => ud.department.name === 'Information Technology') ||
      user.roles.some(ur => ['Staff', 'Manager', 'Admin'].includes(ur.role.name))
    )

    console.log(`Found ${users.length} users and ${assignees.length} potential assignees`)

    let ticketCount = 0

    // Create 50 tickets
    for (let i = 0; i < 50; i++) {
      // Pick random requester from all users
      const requester = users[Math.floor(Math.random() * users.length)]

      // Pick random assignee
      const assignee = assignees[Math.floor(Math.random() * assignees.length)]

      // Pick random template
      const template = additionalTicketTemplates[Math.floor(Math.random() * additionalTicketTemplates.length)]

      // Pick random status and priority
      const randomStatus = ticketStatuses[Math.floor(Math.random() * ticketStatuses.length)]
      const randomPriority = priorities[Math.floor(Math.random() * priorities.length)]

      // Generate ticket number
      const ticketNumber = `TK-${String(existingTicketCount + ticketCount + 1).padStart(6, '0')}`

      const ticket = await prisma.ticket.create({
        data: {
          ticketNumber,
          title: template.title,
          description: template.description,
          category: template.category,
          priority: randomPriority,
          status: randomStatus,
          requesterId: requester.id,
          assigneeId: assignee.id,
          createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Random date within last 14 days
          updatedAt: new Date()
        }
      })

      console.log(`✅ Created ticket ${ticketNumber}: ${template.title} (${requester.firstName} ${requester.lastName} → ${assignee.firstName} ${assignee.lastName})`)

      // Add some random comments to make it realistic
      if (Math.random() > 0.6) {
        const comments = [
          'This issue started yesterday and is getting worse.',
          'I tried restarting but the problem persists.',
          'This is affecting my daily work productivity.',
          'Other team members are experiencing similar issues.',
          'I need this resolved as soon as possible.',
          'This worked fine last week but suddenly stopped.',
          'I followed the troubleshooting guide but no luck.',
          'Can we schedule a remote session to fix this?'
        ]

        await prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            userId: requester.id,
            content: comments[Math.floor(Math.random() * comments.length)],
            isPublic: true,
            createdAt: new Date(ticket.createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) // Within 24 hours of ticket creation
          }
        })
      }

      // Add agent response if ticket is not NEW
      if (Math.random() > 0.5 && randomStatus !== 'NEW') {
        const agentResponses = [
          'I will investigate this issue and get back to you within 24 hours.',
          'I have reproduced the issue and am working on a solution.',
          'Please try the workaround I sent and let me know if it helps.',
          'I have escalated this to our specialist team for further review.',
          'This appears to be related to recent system updates. Investigating.',
          'I will schedule maintenance window to address this issue.',
          'Please provide additional details about when this started.',
          'I have implemented a temporary fix while we work on permanent solution.'
        ]

        await prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            userId: assignee.id,
            content: agentResponses[Math.floor(Math.random() * agentResponses.length)],
            isPublic: true,
            createdAt: new Date(ticket.createdAt.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000) // Within 48 hours
          }
        })
      }

      ticketCount++
    }

    console.log(`🎉 Created ${ticketCount} additional tickets successfully!`)

    // Display updated summary
    const ticketStats = await prisma.ticket.groupBy({
      by: ['status'],
      _count: { id: true }
    })

    console.log('\\n📊 Updated Ticket Summary by Status:')
    ticketStats.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count.id} tickets`)
    })

    const priorityStats = await prisma.ticket.groupBy({
      by: ['priority'],
      _count: { id: true }
    })

    console.log('\\n🔥 Updated Ticket Summary by Priority:')
    priorityStats.forEach(stat => {
      console.log(`  ${stat.priority}: ${stat._count.id} tickets`)
    })

    // Show total count
    const totalTickets = await prisma.ticket.count()
    console.log(`\\n📈 Total tickets in system: ${totalTickets}`)

  } catch (error) {
    console.error('❌ Error creating additional tickets:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
createAdditionalTickets()