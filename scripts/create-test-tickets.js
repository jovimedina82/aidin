import { PrismaClient } from '../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

// Sample ticket data by department and user type
const ticketTemplates = {
  'Marketing Department': [
    {
      title: 'Social Media Campaign Setup',
      description: 'Need assistance setting up a new social media campaign for our latest product launch. Requires access to analytics tools and content management system.',
      category: 'Marketing Tools',
      priority: 'NORMAL'
    },
    {
      title: 'Website Content Update',
      description: 'Update website content for the new product launch. Need CMS access and graphic design support.',
      category: 'Website',
      priority: 'HIGH'
    },
    {
      title: 'Email Marketing Platform Issue',
      description: 'Unable to send email campaigns. Getting error messages when trying to upload contact lists.',
      category: 'Email Marketing',
      priority: 'HIGH'
    },
    {
      title: 'Brand Guidelines Access',
      description: 'New team member needs access to brand guidelines and marketing templates in shared drive.',
      category: 'Access Request',
      priority: 'NORMAL'
    },
    {
      title: 'Marketing Analytics Dashboard',
      description: 'Dashboard showing incorrect conversion rates. Need data verification and dashboard repair.',
      category: 'Analytics',
      priority: 'NORMAL'
    }
  ],
  'Information Technology': [
    {
      title: 'Server Performance Issues',
      description: 'Main application server experiencing high CPU usage and slow response times. Users reporting timeouts.',
      category: 'Infrastructure',
      priority: 'CRITICAL'
    },
    {
      title: 'Network Connectivity Problems',
      description: 'Intermittent network outages in the Operations department. Affecting productivity.',
      category: 'Network',
      priority: 'HIGH'
    },
    {
      title: 'Software License Renewal',
      description: 'Adobe Creative Suite licenses expiring next month. Need to process renewal for marketing team.',
      category: 'Software',
      priority: 'NORMAL'
    },
    {
      title: 'Database Backup Failure',
      description: 'Automated backup system failed last night. Need to investigate and ensure data integrity.',
      category: 'Database',
      priority: 'CRITICAL'
    },
    {
      title: 'VPN Access Setup',
      description: 'Setup VPN access for remote workers. Need secure connection for accessing internal systems.',
      category: 'Security',
      priority: 'NORMAL'
    }
  ],
  'Operations': [
    {
      title: 'Printer Network Configuration',
      description: 'New printer installed but not connecting to network. Staff unable to print documents.',
      category: 'Hardware',
      priority: 'NORMAL'
    },
    {
      title: 'Document Management System',
      description: 'Files not syncing properly in document management system. Version conflicts occurring.',
      category: 'Software',
      priority: 'HIGH'
    },
    {
      title: 'Phone System Issues',
      description: 'Phone system dropping calls and poor call quality. Affecting customer service.',
      category: 'Communication',
      priority: 'HIGH'
    },
    {
      title: 'Facility Access Card Replacement',
      description: 'Access card not working for secure areas. Need replacement and system update.',
      category: 'Security',
      priority: 'NORMAL'
    },
    {
      title: 'Inventory Management Software',
      description: 'Inventory tracking showing incorrect quantities. Need system audit and correction.',
      category: 'Inventory',
      priority: 'NORMAL'
    }
  ],
  'Accounting': [
    {
      title: 'Financial Reporting Software Error',
      description: 'Month-end reports generating with incorrect totals. Critical for financial close.',
      category: 'Financial Software',
      priority: 'CRITICAL'
    },
    {
      title: 'Banking Integration Issues',
      description: 'Bank feed not importing transactions correctly. Need to reconcile accounts manually.',
      category: 'Integration',
      priority: 'HIGH'
    },
    {
      title: 'Payroll System Access',
      description: 'New accounting team member needs access to payroll system for month-end processing.',
      category: 'Access Request',
      priority: 'NORMAL'
    },
    {
      title: 'Tax Software Update',
      description: 'Tax preparation software needs update for new tax regulations. Deadline approaching.',
      category: 'Software',
      priority: 'HIGH'
    },
    {
      title: 'Expense Reporting Mobile App',
      description: 'Mobile expense app not syncing with main system. Receipts not uploading properly.',
      category: 'Mobile App',
      priority: 'NORMAL'
    }
  ]
}

const ticketStatuses = ['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED', 'CLOSED']
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

async function createTestTickets() {
  console.log('🎫 Creating test tickets for hierarchy testing...')

  try {
    // Get current ticket count to avoid conflicts
    const existingTicketCount = await prisma.ticket.count()
    console.log(`Found ${existingTicketCount} existing tickets`)

    // Get all users with their departments
    const users = await prisma.user.findMany({
      include: {
        departments: {
          include: {
            department: true
          }
        },
        manager: true,
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    // Get IT staff for ticket assignments
    const itStaff = users.filter(user =>
      user.departments.some(ud => ud.department.name === 'Information Technology') ||
      user.roles.some(ur => ur.role.name === 'Staff' || ur.role.name === 'Admin')
    )

    console.log(`Found ${users.length} users and ${itStaff.length} potential assignees`)

    let ticketCount = 0

    // Create tickets for each department
    for (const user of users) {
      for (const userDept of user.departments) {
        const deptName = userDept.department.name
        const templates = ticketTemplates[deptName] || []

        // Create 2-3 tickets per user per department
        const numTickets = Math.floor(Math.random() * 2) + 2 // 2-3 tickets

        for (let i = 0; i < numTickets && i < templates.length; i++) {
          const template = templates[i]
          const randomStatus = ticketStatuses[Math.floor(Math.random() * ticketStatuses.length)]
          const randomPriority = priorities[Math.floor(Math.random() * priorities.length)]

          // Assign to random IT staff member
          const assignee = itStaff[Math.floor(Math.random() * itStaff.length)]

          // Generate ticket number starting from existing count
          const ticketNumber = `TK-${String(existingTicketCount + ticketCount + 1).padStart(6, '0')}`

          const ticket = await prisma.ticket.create({
            data: {
              ticketNumber,
              title: template.title,
              description: template.description,
              category: template.category,
              priority: randomPriority,
              status: randomStatus,
              requesterId: user.id,
              assigneeId: assignee.id,
              createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
              updatedAt: new Date()
            }
          })

          console.log(`✅ Created ticket ${ticketNumber}: ${template.title} (${user.firstName} ${user.lastName} → ${assignee.firstName} ${assignee.lastName})`)

          // Add some comments to make it realistic
          if (Math.random() > 0.5) {
            await prisma.ticketComment.create({
              data: {
                ticketId: ticket.id,
                userId: user.id,
                content: 'I also noticed this started happening after the system update last week.',
                isPublic: true,
                createdAt: new Date(ticket.createdAt.getTime() + 60 * 60 * 1000) // 1 hour after ticket creation
              }
            })
          }

          if (Math.random() > 0.6 && randomStatus !== 'NEW') {
            await prisma.ticketComment.create({
              data: {
                ticketId: ticket.id,
                userId: assignee.id,
                content: 'I\'ve started investigating this issue. Will provide an update within 24 hours.',
                isPublic: true,
                createdAt: new Date(ticket.createdAt.getTime() + 2 * 60 * 60 * 1000) // 2 hours after
              }
            })
          }

          ticketCount++

          // Create different priority distributions based on department
          if (deptName === 'Information Technology' && Math.random() > 0.7) {
            // IT gets more critical tickets
            await prisma.ticket.update({
              where: { id: ticket.id },
              data: { priority: 'URGENT' }
            })
          }
        }
      }
    }

    // Create some cross-department tickets (escalations)
    console.log('🔄 Creating cross-department escalation tickets...')

    const managers = users.filter(user =>
      user.directReports?.length > 0 ||
      user.roles.some(ur => ur.role.name === 'Manager' || ur.role.name === 'Admin')
    )

    for (let i = 0; i < 10; i++) {
      const requester = users[Math.floor(Math.random() * users.length)]
      const assignee = managers[Math.floor(Math.random() * managers.length)]
      const ticketNumber = `TK-${String(existingTicketCount + ticketCount + 1).padStart(6, '0')}`

      const escalationTickets = [
        {
          title: 'Department Budget Approval Required',
          description: 'Need approval for additional software licenses and hardware purchases for Q4.',
          category: 'Budget Request',
          priority: 'HIGH'
        },
        {
          title: 'Cross-Department Project Coordination',
          description: 'Coordinating system implementation across Marketing and Operations departments.',
          category: 'Project Management',
          priority: 'NORMAL'
        },
        {
          title: 'Policy Update Implementation',
          description: 'New company security policy needs to be implemented across all departments.',
          category: 'Policy',
          priority: 'HIGH'
        }
      ]

      const template = escalationTickets[i % escalationTickets.length]

      await prisma.ticket.create({
        data: {
          ticketNumber,
          title: template.title,
          description: template.description,
          category: template.category,
          priority: template.priority,
          status: 'OPEN',
          requesterId: requester.id,
          assigneeId: assignee.id,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last 7 days
          updatedAt: new Date()
        }
      })

      ticketCount++
    }

    console.log(`🎉 Created ${ticketCount} test tickets successfully!`)

    // Display summary
    const ticketStats = await prisma.ticket.groupBy({
      by: ['status'],
      _count: { id: true }
    })

    console.log('\n📊 Ticket Summary by Status:')
    ticketStats.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count.id} tickets`)
    })

    const priorityStats = await prisma.ticket.groupBy({
      by: ['priority'],
      _count: { id: true }
    })

    console.log('\n🔥 Ticket Summary by Priority:')
    priorityStats.forEach(stat => {
      console.log(`  ${stat.priority}: ${stat._count.id} tickets`)
    })

    // Show some example hierarchy-based filtering
    console.log('\n🏢 Testing Hierarchy-Based Views:')

    // Example: Get tickets visible to Kristine Smith (Marketing Manager)
    const kristineSmith = users.find(u => u.firstName === 'Kristine' && u.lastName === 'Smith')
    if (kristineSmith) {
      const kristineTickets = await prisma.ticket.findMany({
        where: {
          OR: [
            { requesterId: kristineSmith.id }, // Her own tickets
            { assigneeId: kristineSmith.id }, // Assigned to her
            {
              requester: {
                managerId: kristineSmith.id // Tickets from her direct reports
              }
            }
          ]
        },
        include: {
          requester: true,
          assignee: true
        }
      })

      console.log(`  Kristine Smith (Marketing Manager) can see: ${kristineTickets.length} tickets`)
    }

    // Example: Get tickets visible to Elizabeth P (Operations/Accounting Manager)
    const elizabethP = users.find(u => u.firstName === 'Elizabeth' && u.lastName === 'P')
    if (elizabethP) {
      const elizabethTickets = await prisma.ticket.findMany({
        where: {
          OR: [
            { requesterId: elizabethP.id },
            { assigneeId: elizabethP.id },
            {
              requester: {
                managerId: elizabethP.id
              }
            }
          ]
        },
        include: {
          requester: true,
          assignee: true
        }
      })

      console.log(`  Elizabeth P (Operations/Accounting Manager) can see: ${elizabethTickets.length} tickets`)
    }

  } catch (error) {
    console.error('❌ Error creating test tickets:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
createTestTickets()