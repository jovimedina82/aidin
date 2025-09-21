import { PrismaClient } from '../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

// 15 new client users
const clientUsers = [
  {
    firstName: 'Michael',
    lastName: 'Johnson',
    email: 'michael.johnson@clientcompany.com',
    userType: 'Client'
  },
  {
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'sarah.williams@businesscorp.com',
    userType: 'Client'
  },
  {
    firstName: 'David',
    lastName: 'Brown',
    email: 'david.brown@techstartup.com',
    userType: 'Client'
  },
  {
    firstName: 'Jennifer',
    lastName: 'Davis',
    email: 'jennifer.davis@retailstore.com',
    userType: 'Client'
  },
  {
    firstName: 'Robert',
    lastName: 'Miller',
    email: 'robert.miller@lawfirm.com',
    userType: 'Client'
  },
  {
    firstName: 'Lisa',
    lastName: 'Wilson',
    email: 'lisa.wilson@healthclinic.com',
    userType: 'Client'
  },
  {
    firstName: 'James',
    lastName: 'Moore',
    email: 'james.moore@restaurant.com',
    userType: 'Client'
  },
  {
    firstName: 'Karen',
    lastName: 'Taylor',
    email: 'karen.taylor@construction.com',
    userType: 'Client'
  },
  {
    firstName: 'Thomas',
    lastName: 'Anderson',
    email: 'thomas.anderson@consulting.com',
    userType: 'Client'
  },
  {
    firstName: 'Amanda',
    lastName: 'Jackson',
    email: 'amanda.jackson@nonprofit.org',
    userType: 'Client'
  },
  {
    firstName: 'Christopher',
    lastName: 'White',
    email: 'chris.white@manufacturing.com',
    userType: 'Client'
  },
  {
    firstName: 'Michelle',
    lastName: 'Harris',
    email: 'michelle.harris@education.edu',
    userType: 'Client'
  },
  {
    firstName: 'Daniel',
    lastName: 'Martin',
    email: 'daniel.martin@finance.com',
    userType: 'Client'
  },
  {
    firstName: 'Ashley',
    lastName: 'Thompson',
    email: 'ashley.thompson@realestate.com',
    userType: 'Client'
  },
  {
    firstName: 'Kevin',
    lastName: 'Garcia',
    email: 'kevin.garcia@logistics.com',
    userType: 'Client'
  }
]

// Client-specific ticket templates
const clientTicketTemplates = [
  {
    title: 'Website Not Loading Properly',
    description: 'Our company website is not loading correctly for customers. Pages are blank or showing errors.',
    category: 'Website Support',
    priority: 'HIGH'
  },
  {
    title: 'Email Server Configuration',
    description: 'Need help configuring our new email server. Emails are not being delivered properly.',
    category: 'Email Support',
    priority: 'HIGH'
  },
  {
    title: 'Database Performance Issues',
    description: 'Our customer database is running very slowly. Queries are timing out and affecting operations.',
    category: 'Database Support',
    priority: 'URGENT'
  },
  {
    title: 'Security Audit Request',
    description: 'We need a comprehensive security audit of our IT infrastructure and systems.',
    category: 'Security Consultation',
    priority: 'NORMAL'
  },
  {
    title: 'Network Infrastructure Setup',
    description: 'Need assistance setting up network infrastructure for our new office location.',
    category: 'Network Setup',
    priority: 'NORMAL'
  },
  {
    title: 'Data Backup Solution',
    description: 'Looking for a reliable data backup solution for our critical business data.',
    category: 'Backup Services',
    priority: 'HIGH'
  },
  {
    title: 'Software Installation Support',
    description: 'Need help installing and configuring business software across multiple workstations.',
    category: 'Software Support',
    priority: 'NORMAL'
  },
  {
    title: 'Remote Access Setup',
    description: 'Need to set up secure remote access for our employees working from home.',
    category: 'Remote Access',
    priority: 'HIGH'
  },
  {
    title: 'Server Migration Project',
    description: 'Planning to migrate our servers to new hardware. Need professional assistance.',
    category: 'Server Migration',
    priority: 'URGENT'
  },
  {
    title: 'Firewall Configuration',
    description: 'Need help configuring our firewall to better protect against cyber threats.',
    category: 'Security Configuration',
    priority: 'HIGH'
  },
  {
    title: 'System Integration Support',
    description: 'Need to integrate our CRM system with our accounting software.',
    category: 'System Integration',
    priority: 'NORMAL'
  },
  {
    title: 'Cloud Migration Planning',
    description: 'Considering moving our infrastructure to the cloud. Need consultation and planning.',
    category: 'Cloud Services',
    priority: 'NORMAL'
  },
  {
    title: 'Printer Network Issues',
    description: 'Office printers are not connecting to the network properly. Staff cannot print.',
    category: 'Hardware Support',
    priority: 'NORMAL'
  },
  {
    title: 'WiFi Coverage Problems',
    description: 'WiFi signal is weak in certain areas of our office. Need coverage improvement.',
    category: 'Network Support',
    priority: 'NORMAL'
  },
  {
    title: 'Data Recovery Emergency',
    description: 'Hard drive crashed and we lost important client data. Need immediate recovery assistance.',
    category: 'Data Recovery',
    priority: 'URGENT'
  },
  {
    title: 'Antivirus Configuration',
    description: 'Need help selecting and configuring appropriate antivirus solution for our business.',
    category: 'Security Software',
    priority: 'HIGH'
  },
  {
    title: 'Business Phone System',
    description: 'Need to upgrade our phone system to support more lines and modern features.',
    category: 'Communication Systems',
    priority: 'NORMAL'
  },
  {
    title: 'Point of Sale System',
    description: 'Our POS system is malfunctioning. Cannot process customer transactions.',
    category: 'POS Support',
    priority: 'URGENT'
  },
  {
    title: 'Network Security Assessment',
    description: 'Need professional assessment of our network security vulnerabilities.',
    category: 'Security Assessment',
    priority: 'HIGH'
  },
  {
    title: 'IT Equipment Procurement',
    description: 'Need advice on purchasing new computers and IT equipment for expanding team.',
    category: 'IT Consultation',
    priority: 'LOW'
  }
]

const ticketStatuses = ['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED']
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

async function createClientUsersAndTickets() {
  console.log('👥 Creating 15 client users and their tickets...')

  try {
    // Create client users first
    console.log('Creating client users...')
    const createdClients = []

    for (const clientData of clientUsers) {
      const client = await prisma.user.create({
        data: {
          firstName: clientData.firstName,
          lastName: clientData.lastName,
          email: clientData.email,
          password: '$2b$10$defaulthashedpassword', // Default password hash
          userType: clientData.userType,
          isActive: true
        }
      })

      createdClients.push(client)
      console.log(`✅ Created client: ${client.firstName} ${client.lastName} (${client.email})`)
    }

    console.log(`\n🎫 Creating tickets from client users...`)

    // Get current ticket count
    const existingTicketCount = await prisma.ticket.count()
    console.log(`Found ${existingTicketCount} existing tickets`)

    // Get potential assignees (IT staff, managers, admins)
    const assignees = await prisma.user.findMany({
      where: {
        OR: [
          {
            departments: {
              some: {
                department: {
                  name: 'Information Technology'
                }
              }
            }
          },
          {
            roles: {
              some: {
                role: {
                  name: {
                    in: ['Staff', 'Manager', 'Admin']
                  }
                }
              }
            }
          }
        ]
      },
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

    console.log(`Found ${assignees.length} potential assignees`)

    let ticketCount = 0

    // Create 2-4 tickets per client (30-60 total tickets)
    for (const client of createdClients) {
      const numTickets = Math.floor(Math.random() * 3) + 2 // 2-4 tickets per client

      for (let i = 0; i < numTickets; i++) {
        // Pick random template
        const template = clientTicketTemplates[Math.floor(Math.random() * clientTicketTemplates.length)]

        // Pick random assignee
        const assignee = assignees[Math.floor(Math.random() * assignees.length)]

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
            requesterId: client.id,
            assigneeId: assignee.id,
            createdAt: new Date(Date.now() - Math.random() * 21 * 24 * 60 * 60 * 1000), // Random date within last 21 days
            updatedAt: new Date()
          }
        })

        console.log(`✅ Created ticket ${ticketNumber}: ${template.title} (${client.firstName} ${client.lastName} → ${assignee.firstName} ${assignee.lastName})`)

        // Add client follow-up comments
        if (Math.random() > 0.4) {
          const clientComments = [
            'This is affecting our business operations significantly.',
            'Our customers are starting to complain about this issue.',
            'We need this resolved as soon as possible.',
            'This problem started after the recent update.',
            'Can you provide an estimated time for resolution?',
            'We are losing revenue due to this issue.',
            'This is becoming a critical business issue.',
            'Our staff cannot work efficiently with this problem.',
            'Please prioritize this request as it affects multiple users.',
            'We may need to schedule after-hours maintenance.',
            'This issue is preventing us from serving our customers.',
            'Can we schedule a call to discuss this further?'
          ]

          await prisma.ticketComment.create({
            data: {
              ticketId: ticket.id,
              userId: client.id,
              content: clientComments[Math.floor(Math.random() * clientComments.length)],
              isPublic: true,
              createdAt: new Date(ticket.createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000)
            }
          })
        }

        // Add agent response if not NEW
        if (Math.random() > 0.3 && randomStatus !== 'NEW') {
          const agentResponses = [
            'I understand the urgency of this issue and am prioritizing it.',
            'I have escalated this to our senior technical team.',
            'I will provide a detailed action plan within 4 hours.',
            'We have identified the root cause and are implementing a fix.',
            'I will schedule a maintenance window to resolve this completely.',
            'Our team is working on this issue with high priority.',
            'I will keep you updated every 2 hours on our progress.',
            'We have implemented a temporary workaround while we fix the underlying issue.',
            'I need to gather some additional information to proceed.',
            'This issue requires coordination with our infrastructure team.',
            'I will arrange for an on-site visit if needed.',
            'We are testing a solution in our lab environment first.'
          ]

          await prisma.ticketComment.create({
            data: {
              ticketId: ticket.id,
              userId: assignee.id,
              content: agentResponses[Math.floor(Math.random() * agentResponses.length)],
              isPublic: true,
              createdAt: new Date(ticket.createdAt.getTime() + Math.random() * 48 * 60 * 60 * 1000)
            }
          })
        }

        ticketCount++
      }
    }

    console.log(`\n🎉 Created ${createdClients.length} client users and ${ticketCount} tickets successfully!`)

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

    // Show user type distribution
    const userStats = await prisma.user.groupBy({
      by: ['userType'],
      _count: { id: true }
    })

    console.log('\\n👥 User Summary by Type:')
    userStats.forEach(stat => {
      console.log(`  ${stat.userType}: ${stat._count.id} users`)
    })

    // Show total count
    const totalTickets = await prisma.ticket.count()
    const totalUsers = await prisma.user.count()
    console.log(`\\n📈 Total tickets in system: ${totalTickets}`)
    console.log(`📈 Total users in system: ${totalUsers}`)

  } catch (error) {
    console.error('❌ Error creating client users and tickets:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
createClientUsersAndTickets()