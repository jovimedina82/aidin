import { PrismaClient } from '../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

const defaultModules = [
  // Core modules - cannot be disabled
  {
    name: 'Dashboard',
    key: 'dashboard',
    description: 'Main dashboard with ticket statistics and overview',
    icon: 'Home',
    route: '/dashboard',
    category: 'core',
    isCore: true,
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Profile',
    key: 'profile',
    description: 'User profile and settings',
    icon: 'User',
    route: '/profile',
    category: 'core',
    isCore: true,
    isActive: true,
    sortOrder: 20
  },

  // Main feature modules
  {
    name: 'Tickets',
    key: 'tickets',
    description: 'View and manage support tickets',
    icon: 'Ticket',
    route: '/tickets',
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'Users',
    key: 'users',
    description: 'Manage customers and user accounts',
    icon: 'Users',
    route: '/users',
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 3
  },
  {
    name: 'Organizations',
    key: 'organizations',
    description: 'Manage customer organizations',
    icon: 'Building2',
    route: '/organizations',
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 4
  },
  {
    name: 'Knowledge Base',
    key: 'knowledge-base',
    description: 'Knowledge base articles and documentation',
    icon: 'BookOpen',
    route: '/knowledge-base',
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 5
  },
  {
    name: 'Reports',
    key: 'reports',
    description: 'Analytics and reporting',
    icon: 'BarChart3',
    route: '/reports',
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 6
  },

  // Admin modules
  {
    name: 'Admin Settings',
    key: 'admin',
    description: 'Administrative settings and configuration',
    icon: 'Settings',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 10
  },
  {
    name: 'User Management',
    key: 'user-management',
    description: 'Manage system users, roles, and permissions',
    icon: 'Users',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 11
  },
  {
    name: 'All Tickets Management',
    key: 'all-tickets',
    description: 'Access to all tickets across departments',
    icon: 'Ticket',
    route: '/tickets',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 12
  },
  {
    name: 'Departments',
    key: 'departments',
    description: 'Manage departments and ticket routing',
    icon: 'Building',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 13
  },
  {
    name: 'AI Administration',
    key: 'ai-admin',
    description: 'Configure AI settings and responses',
    icon: 'Brain',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 14
  },
  {
    name: 'Azure AD Sync',
    key: 'azure-sync',
    description: 'Synchronize users with Azure AD',
    icon: 'Cloud',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 15
  },
  {
    name: 'Audit Log',
    key: 'audit-log',
    description: 'View system audit logs and user activity',
    icon: 'FileText',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 16
  },
  {
    name: 'System Settings',
    key: 'settings',
    description: 'Configure system-wide settings',
    icon: 'Settings',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 17
  },
  {
    name: 'Integrations',
    key: 'integrations',
    description: 'Manage third-party integrations',
    icon: 'Puzzle',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 18
  },
  {
    name: 'Blocked Domains',
    key: 'blocked-domains',
    description: 'Manage blocked email domains',
    icon: 'Shield',
    route: '/admin',
    category: 'admin',
    isCore: false,
    isActive: true,
    sortOrder: 19
  },

  // Feature toggles
  {
    name: 'Auto-Assign Tickets',
    key: 'auto-assign',
    description: 'Automatic ticket assignment to staff',
    icon: 'Zap',
    route: null,
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 30
  },
  {
    name: 'Public Registration',
    key: 'public-registration',
    description: 'Allow public user registration',
    icon: 'UserPlus',
    route: null,
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 31
  },
  {
    name: 'Inbound Email',
    key: 'inbound-email',
    description: 'Process inbound emails as tickets',
    icon: 'Mail',
    route: null,
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 32
  },
  {
    name: 'AI Draft Responses',
    key: 'ai-drafts',
    description: 'AI-generated ticket response drafts',
    icon: 'Sparkles',
    route: null,
    category: 'features',
    isCore: false,
    isActive: true,
    sortOrder: 33
  }
]

// Default module access by role
const roleModuleAccess = {
  Admin: ['*'], // All modules
  Manager: [
    'dashboard',
    'tickets',
    'users',
    'organizations',
    'knowledge-base',
    'reports',
    'all-tickets',
    'departments',
    'auto-assign',
    'ai-drafts'
  ],
  Staff: [
    'dashboard',
    'tickets',
    'users',
    'organizations',
    'knowledge-base',
    'ai-drafts'
  ],
  Requester: [
    'dashboard',
    'tickets'
  ]
}

async function main() {
  console.log('🌱 Seeding modules...')

  // Create all modules
  for (const moduleData of defaultModules) {
    const module = await prisma.module.upsert({
      where: { key: moduleData.key },
      update: moduleData,
      create: moduleData
    })
    console.log(`  ✓ ${module.name} (${module.key})`)
  }

  console.log('\n🔐 Setting up default role-based module access...')

  // Get all roles
  const roles = await prisma.role.findMany()
  const modules = await prisma.module.findMany()

  for (const role of roles) {
    const allowedModuleKeys = roleModuleAccess[role.name] || []
    const hasFullAccess = allowedModuleKeys.includes('*')

    for (const module of modules) {
      const hasAccess = hasFullAccess || allowedModuleKeys.includes(module.key) || module.isCore

      await prisma.roleModuleAccess.upsert({
        where: {
          roleId_moduleId: {
            roleId: role.id,
            moduleId: module.id
          }
        },
        update: { hasAccess },
        create: {
          roleId: role.id,
          moduleId: module.id,
          hasAccess
        }
      })
    }

    console.log(`  ✓ ${role.name}: ${hasFullAccess ? 'All modules' : allowedModuleKeys.length + ' modules'}`)
  }

  console.log('\n✅ Module seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Failed to seed modules:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
