import { PrismaClient } from '../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

// Organizational chart data based on the provided diagram
const orgChart = {
  // Top level (Gary is the root)
  'Gary': {
    firstName: 'Gary',
    lastName: 'L',
    email: 'gary@surterreproperties.com',
    manager: null,
    departments: []
  },

  // First level managers reporting to Gary
  'Kristine Smith': {
    firstName: 'Kristine',
    lastName: 'Smith',
    email: 'kristine.smith@surterreproperties.com',
    manager: 'Gary',
    departments: ['Marketing Department']
  },
  'John B': {
    firstName: 'John',
    lastName: 'B',
    email: 'john.b@surterreproperties.com',
    manager: 'Gary',
    departments: ['Information Technology']
  },
  'Elizabeth P': {
    firstName: 'Elizabeth',
    lastName: 'P',
    email: 'elizabeth.p@surterreproperties.com',
    manager: 'Gary',
    departments: ['Operations', 'Accounting']
  },

  // Marketing team reporting to Kristine Smith
  'Alicia M': {
    firstName: 'Alicia',
    lastName: 'M',
    email: 'alicia.m@surterreproperties.com',
    manager: 'Kristine Smith',
    departments: ['Marketing Department']
  },
  'Mari C': {
    firstName: 'Mari',
    lastName: 'C',
    email: 'mari.c@surterreproperties.com',
    manager: 'Kristine Smith',
    departments: ['Marketing Department']
  },
  'Catie S': {
    firstName: 'Catie',
    lastName: 'S',
    email: 'catie.s@surterreproperties.com',
    manager: 'Kristine Smith',
    departments: ['Marketing Department']
  },
  'Marissa W': {
    firstName: 'Marissa',
    lastName: 'W',
    email: 'marissa.w@surterreproperties.com',
    manager: 'Kristine Smith',
    departments: ['Marketing Department']
  },
  'Christy G': {
    firstName: 'Christy',
    lastName: 'G',
    email: 'christy.g@surterreproperties.com',
    manager: 'Kristine Smith',
    departments: ['Marketing Department']
  },

  // IT team reporting to John B
  'Aidin AI': {
    firstName: 'Aidin',
    lastName: 'AI',
    email: 'aidin@surterreproperties.com',
    manager: 'John B',
    departments: ['Information Technology']
  },

  // Operations team reporting to Elizabeth P
  'Jovi M': {
    firstName: 'Jovi',
    lastName: 'M',
    email: 'jovi.m@surterreproperties.com',
    manager: 'Elizabeth P',
    departments: ['Operations']
  },
  'Lori S': {
    firstName: 'Lori',
    lastName: 'S',
    email: 'lori.s@surterreproperties.com',
    manager: 'Elizabeth P',
    departments: ['Operations']
  },
  'Michelle M': {
    firstName: 'Michelle',
    lastName: 'M',
    email: 'michelle.m@surterreproperties.com',
    manager: 'Elizabeth P',
    departments: ['Operations']
  },
  'Cathleen M': {
    firstName: 'Cathleen',
    lastName: 'M',
    email: 'cathleen.m@surterreproperties.com',
    manager: 'Elizabeth P',
    departments: ['Operations']
  },
  'Ann Mari B': {
    firstName: 'Ann Mari',
    lastName: 'B',
    email: 'annmari.b@surterreproperties.com',
    manager: 'Elizabeth P',
    departments: ['Operations']
  },

  // Accounting team reporting to Elizabeth P
  'Nicole P': {
    firstName: 'Nicole',
    lastName: 'P',
    email: 'nicole.p@surterreproperties.com',
    manager: 'Elizabeth P',
    departments: ['Accounting']
  },
  'Noele B': {
    firstName: 'Noele',
    lastName: 'B',
    email: 'noele.b@surterreproperties.com',
    manager: 'Elizabeth P',
    departments: ['Accounting']
  },
  'Molly G': {
    firstName: 'Molly',
    lastName: 'G',
    email: 'molly.g@surterreproperties.com',
    manager: 'Elizabeth P',
    departments: ['Accounting']
  }
}

async function setupOrganizationalChart() {
  console.log('🏗️ Setting up organizational chart...')

  try {
    // First, get existing departments
    const departments = await prisma.department.findMany()
    const departmentMap = {}
    departments.forEach(dept => {
      departmentMap[dept.name] = dept.id
    })

    // Create or update users and store their IDs
    const userMap = {}

    // Phase 1: Create/update all users without manager relationships
    for (const [fullName, userData] of Object.entries(orgChart)) {
      console.log(`Creating/updating user: ${fullName}`)

      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          userType: 'Employee'
        },
        create: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          password: '$2b$10$defaulthashedpassword', // Default password hash
          userType: 'Employee',
          isActive: true
        }
      })

      userMap[fullName] = user.id
      console.log(`✅ User ${fullName} created/updated with ID: ${user.id}`)
    }

    // Phase 2: Set up manager relationships
    for (const [fullName, userData] of Object.entries(orgChart)) {
      if (userData.manager) {
        console.log(`Setting manager for ${fullName} -> ${userData.manager}`)

        await prisma.user.update({
          where: { id: userMap[fullName] },
          data: {
            managerId: userMap[userData.manager]
          }
        })

        console.log(`✅ Manager relationship set: ${fullName} -> ${userData.manager}`)
      }
    }

    // Phase 3: Set up department assignments
    for (const [fullName, userData] of Object.entries(orgChart)) {
      if (userData.departments.length > 0) {
        console.log(`Assigning departments for ${fullName}: ${userData.departments.join(', ')}`)

        // Remove existing department assignments
        await prisma.userDepartment.deleteMany({
          where: { userId: userMap[fullName] }
        })

        // Add new department assignments
        for (const deptName of userData.departments) {
          if (departmentMap[deptName]) {
            await prisma.userDepartment.create({
              data: {
                userId: userMap[fullName],
                departmentId: departmentMap[deptName]
              }
            })
            console.log(`✅ Assigned ${fullName} to ${deptName}`)
          } else {
            console.warn(`⚠️ Department '${deptName}' not found`)
          }
        }
      }
    }

    console.log('🎉 Organizational chart setup completed!')

    // Display the hierarchy
    console.log('\\n📊 Organizational Chart:')
    await displayHierarchy()

  } catch (error) {
    console.error('❌ Error setting up organizational chart:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function displayHierarchy() {
  const users = await prisma.user.findMany({
    include: {
      manager: true,
      directReports: true,
      departments: {
        include: {
          department: true
        }
      }
    }
  })

  // Find root users (no manager)
  const rootUsers = users.filter(user => !user.managerId)

  function printUser(user, level = 0) {
    const indent = '  '.repeat(level)
    const departments = user.departments.map(ud => ud.department.name).join(', ')
    console.log(`${indent}${user.firstName} ${user.lastName} ${departments ? `(${departments})` : ''}`)

    // Print direct reports
    const directReports = users.filter(u => u.managerId === user.id)
    directReports.forEach(report => printUser(report, level + 1))
  }

  rootUsers.forEach(rootUser => printUser(rootUser))
}

// Run the setup
setupOrganizationalChart()