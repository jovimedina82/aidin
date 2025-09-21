import { PrismaClient } from '../lib/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create roles
  console.log('Creating roles...')
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Full system administrator access',
      permissions: JSON.stringify([
        'manage_users', 'manage_roles', 'manage_slas', 'manage_settings',
        'view_all_tickets', 'assign_tickets', 'resolve_tickets',
        'view_reports', 'manage_knowledge_base', 'manage_automations'
      ])
    }
  })

  const managerRole = await prisma.role.upsert({
    where: { name: 'Manager' },
    update: {},
    create: {
      name: 'Manager',
      description: 'Manager with full ticket and user management access',
      permissions: JSON.stringify([
        'manage_users', 'manage_roles', 'manage_slas',
        'view_all_tickets', 'assign_tickets', 'resolve_tickets',
        'view_reports', 'manage_knowledge_base', 'manage_automations'
      ])
    }
  })

  const staffRole = await prisma.role.upsert({
    where: { name: 'Staff' },
    update: {},
    create: {
      name: 'Staff',
      description: 'Support staff with ticket resolution capabilities',
      permissions: JSON.stringify([
        'view_assigned_tickets', 'resolve_tickets', 'comment_tickets',
        'view_knowledge_base', 'create_knowledge_base', 'escalate_tickets'
      ])
    }
  })

  const requesterRole = await prisma.role.upsert({
    where: { name: 'Requester' },
    update: {},
    create: {
      name: 'Requester',
      description: 'Can create and view own tickets',
      permissions: JSON.stringify([
        'create_ticket', 'view_own_tickets', 'comment_own_tickets'
      ])
    }
  })

  // Create departments
  console.log('Creating departments...')
  const itDepartment = await prisma.department.upsert({
    where: { name: 'Information Technology' },
    update: {},
    create: {
      name: 'Information Technology',
      description: 'IT support and infrastructure management',
      isActive: true
    }
  })

  const hrDepartment = await prisma.department.upsert({
    where: { name: 'Human Resources' },
    update: {},
    create: {
      name: 'Human Resources',
      description: 'Human resources and employee management',
      isActive: true
    }
  })

  const financeDepartment = await prisma.department.upsert({
    where: { name: 'Finance' },
    update: {},
    create: {
      name: 'Finance',
      description: 'Financial operations and accounting',
      isActive: true
    }
  })

  const operationsDepartment = await prisma.department.upsert({
    where: { name: 'Operations' },
    update: {},
    create: {
      name: 'Operations',
      description: 'Day-to-day operational activities',
      isActive: true
    }
  })

  // Create users
  console.log('Creating users...')
  const hashedPassword = await bcrypt.hash('admin123', 12)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@surterreproperties.com' },
    update: {},
    create: {
      email: 'admin@surterreproperties.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true
    }
  })

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@surterreproperties.com' },
    update: {},
    create: {
      email: 'manager@surterreproperties.com',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Manager',
      isActive: true
    }
  })

  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@surterreproperties.com' },
    update: {},
    create: {
      email: 'staff@surterreproperties.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Staff',
      isActive: true
    }
  })

  const requesterUser = await prisma.user.upsert({
    where: { email: 'user@surterreproperties.com' },
    update: {},
    create: {
      email: 'user@surterreproperties.com',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      isActive: true
    }
  })

  // Assign roles
  console.log('Assigning roles...')

  // Check and create role assignments if they don't exist
  const roleAssignments = [
    { userId: adminUser.id, roleId: adminRole.id },
    { userId: managerUser.id, roleId: managerRole.id },
    { userId: staffUser.id, roleId: staffRole.id },
    { userId: requesterUser.id, roleId: requesterRole.id }
  ]

  for (const assignment of roleAssignments) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: assignment.userId,
          roleId: assignment.roleId
        }
      },
      update: {},
      create: assignment
    })
  }

  // Assign departments
  console.log('Assigning departments...')

  const departmentAssignments = [
    { userId: adminUser.id, departmentId: itDepartment.id },
    { userId: managerUser.id, departmentId: operationsDepartment.id },
    { userId: managerUser.id, departmentId: itDepartment.id }, // Manager in multiple departments
    { userId: staffUser.id, departmentId: itDepartment.id },
    { userId: requesterUser.id, departmentId: hrDepartment.id }
  ]

  for (const assignment of departmentAssignments) {
    await prisma.userDepartment.upsert({
      where: {
        userId_departmentId: {
          userId: assignment.userId,
          departmentId: assignment.departmentId
        }
      },
      update: {},
      create: assignment
    })
  }

  // Create sample tickets
  console.log('Creating sample tickets...')
  const sampleTickets = [
    {
      ticketNumber: 'TICK-1001',
      title: 'Cannot access email account',
      description: 'I am unable to access my email account since this morning. Getting authentication errors when trying to log in.',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'Account Access',
      requesterId: requesterUser.id,
      assigneeId: staffUser.id
    },
    {
      ticketNumber: 'TICK-1002',
      title: 'Printer not working in Office 201',
      description: 'The printer in Office 201 is showing error code E-5-2. It was working fine yesterday but today it won\'t print anything.',
      status: 'NEW',
      priority: 'NORMAL',
      category: 'Hardware Problem',
      requesterId: requesterUser.id
    },
    {
      ticketNumber: 'TICK-1003',
      title: 'Request for software installation',
      description: 'I need Adobe Photoshop installed on my workstation for the marketing project. Please let me know the process.',
      status: 'PENDING',
      priority: 'LOW',
      category: 'Feature Request',
      requesterId: requesterUser.id,
      assigneeId: staffUser.id
    }
  ]

  for (const ticketData of sampleTickets) {
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: ticketData.ticketNumber },
      update: {},
      create: ticketData
    })

    // Add sample comments if they don't exist
    const existingComment = await prisma.ticketComment.findFirst({
      where: { ticketId: ticket.id, userId: staffUser.id }
    })

    if (!existingComment) {
      await prisma.ticketComment.create({
        data: {
          ticketId: ticket.id,
          userId: staffUser.id,
          content: 'Thank you for your ticket. I will look into this issue and get back to you shortly.',
          isPublic: true
        }
      })
    }
  }

  console.log('✅ Database seeded successfully!')
  console.log('\n📋 Test Accounts Created:')
  console.log('👤 Admin: admin@surterreproperties.com / admin123')
  console.log('👤 Manager: manager@surterreproperties.com / admin123')
  console.log('👤 Staff: staff@surterreproperties.com / admin123')
  console.log('👤 User: user@surterreproperties.com / admin123')
  console.log('\n🎫 Sample tickets created with various statuses')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })