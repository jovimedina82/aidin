import { prisma } from './prisma'

/**
 * Check if a user has access to a specific module
 *
 * Access hierarchy:
 * 1. User-specific override (UserModuleAccess) takes precedence
 * 2. Role-based access (RoleModuleAccess) if no user override
 * 3. Core modules are always accessible
 *
 * @param {Object} user - User object with roles
 * @param {string} moduleKey - Module key to check (e.g., 'tickets', 'admin')
 * @returns {Promise<boolean>}
 */
export async function hasModuleAccess(user, moduleKey) {
  if (!user) return false

  // Get the module
  const moduleData = await prisma.module.findUnique({
    where: { key: moduleKey },
    include: {
      userModuleAccess: {
        where: { userId: user.id }
      },
      roleModuleAccess: {
        where: {
          roleId: {
            in: user.roles.map(r =>
              typeof r === 'string' ? r : (r.roleId || r.role?.id || r.id)
            )
          }
        }
      }
    }
  })

  if (!moduleData) return false
  if (!moduleData.isActive) return false
  if (moduleData.isCore) return true // Core modules always accessible

  // Check user-specific override first
  if (moduleData.userModuleAccess.length > 0) {
    return moduleData.userModuleAccess[0].hasAccess
  }

  // Check role-based access
  if (moduleData.roleModuleAccess.length > 0) {
    // User has access if ANY of their roles has access
    return moduleData.roleModuleAccess.some(rma => rma.hasAccess)
  }

  // Default deny if no access rules found
  return false
}

/**
 * Get all modules accessible by a user
 *
 * @param {Object} user - User object with roles
 * @returns {Promise<Array>} Array of accessible modules
 */
export async function getUserModules(user) {
  if (!user) return []

  // Get user's role IDs
  const roleIds = user.roles.map(r =>
    typeof r === 'string' ? r : (r.roleId || r.role?.id || r.id)
  )

  // Get all active modules with access data
  const modules = await prisma.module.findMany({
    where: { isActive: true },
    include: {
      userModuleAccess: {
        where: { userId: user.id }
      },
      roleModuleAccess: {
        where: {
          roleId: { in: roleIds }
        }
      }
    },
    orderBy: { sortOrder: 'asc' }
  })

  // Filter modules based on access
  return modules.filter(module => {
    // Core modules always included
    if (module.isCore) return true

    // User-specific override
    if (module.userModuleAccess.length > 0) {
      return module.userModuleAccess[0].hasAccess
    }

    // Role-based access
    if (module.roleModuleAccess.length > 0) {
      return module.roleModuleAccess.some(rma => rma.hasAccess)
    }

    return false
  })
}

/**
 * Get all modules accessible by a specific role
 *
 * @param {string} roleId - Role ID
 * @returns {Promise<Array>} Array of accessible modules
 */
export async function getRoleModules(roleId) {
  const modules = await prisma.module.findMany({
    where: { isActive: true },
    include: {
      roleModuleAccess: {
        where: { roleId }
      }
    },
    orderBy: { sortOrder: 'asc' }
  })

  return modules.filter(module => {
    if (module.isCore) return true
    if (module.roleModuleAccess.length > 0) {
      return module.roleModuleAccess[0].hasAccess
    }
    return false
  })
}

/**
 * Grant or revoke module access for a user
 *
 * @param {string} userId - User ID
 * @param {string} moduleKey - Module key
 * @param {boolean} hasAccess - Grant (true) or revoke (false) access
 * @param {string} grantedBy - Admin user ID who made the change
 * @returns {Promise<Object>} Updated or created UserModuleAccess record
 */
export async function setUserModuleAccess(userId, moduleKey, hasAccess, grantedBy) {
  const moduleData = await prisma.module.findUnique({
    where: { key: moduleKey }
  })

  if (!moduleData) {
    throw new Error(`Module not found: ${moduleKey}`)
  }

  if (moduleData.isCore) {
    throw new Error(`Cannot modify access to core module: ${moduleKey}`)
  }

  return await prisma.userModuleAccess.upsert({
    where: {
      userId_moduleId: {
        userId,
        moduleId: moduleData.id
      }
    },
    update: {
      hasAccess,
      grantedBy
    },
    create: {
      userId,
      moduleId: moduleData.id,
      hasAccess,
      grantedBy
    }
  })
}

/**
 * Grant or revoke module access for a role
 *
 * @param {string} roleId - Role ID
 * @param {string} moduleKey - Module key
 * @param {boolean} hasAccess - Grant (true) or revoke (false) access
 * @returns {Promise<Object>} Updated or created RoleModuleAccess record
 */
export async function setRoleModuleAccess(roleId, moduleKey, hasAccess) {
  const moduleData = await prisma.module.findUnique({
    where: { key: moduleKey }
  })

  if (!moduleData) {
    throw new Error(`Module not found: ${moduleKey}`)
  }

  if (moduleData.isCore) {
    throw new Error(`Cannot modify access to core module: ${moduleKey}`)
  }

  return await prisma.roleModuleAccess.upsert({
    where: {
      roleId_moduleId: {
        roleId,
        moduleId: moduleData.id
      }
    },
    update: { hasAccess },
    create: {
      roleId,
      moduleId: moduleData.id,
      hasAccess
    }
  })
}

/**
 * Remove user-specific module access override
 * (Falls back to role-based access)
 *
 * @param {string} userId - User ID
 * @param {string} moduleKey - Module key
 * @returns {Promise<void>}
 */
export async function removeUserModuleOverride(userId, moduleKey) {
  const moduleData = await prisma.module.findUnique({
    where: { key: moduleKey }
  })

  if (!moduleData) {
    throw new Error(`Module not found: ${moduleKey}`)
  }

  await prisma.userModuleAccess.deleteMany({
    where: {
      userId,
      moduleId: moduleData.id
    }
  })
}

/**
 * Get module access summary for a user
 * Shows which modules they have access to and why (role-based, user override, or core)
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of modules with access reason
 */
export async function getUserModuleAccessSummary(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  })

  if (!user) {
    throw new Error('User not found')
  }

  const roleIds = user.roles.map(ur => ur.roleId)

  const modules = await prisma.module.findMany({
    where: { isActive: true },
    include: {
      userModuleAccess: {
        where: { userId }
      },
      roleModuleAccess: {
        where: {
          roleId: { in: roleIds }
        }
      }
    },
    orderBy: { sortOrder: 'asc' }
  })

  return modules.map(module => {
    let hasAccess = false
    let accessReason = 'denied'

    if (module.isCore) {
      hasAccess = true
      accessReason = 'core'
    } else if (module.userModuleAccess.length > 0) {
      hasAccess = module.userModuleAccess[0].hasAccess
      accessReason = hasAccess ? 'user-override-granted' : 'user-override-denied'
    } else if (module.roleModuleAccess.length > 0) {
      const granted = module.roleModuleAccess.some(rma => rma.hasAccess)
      hasAccess = granted
      accessReason = granted ? 'role-based' : 'role-denied'
    }

    return {
      ...module,
      hasAccess,
      accessReason,
      userModuleAccess: undefined,
      roleModuleAccess: undefined
    }
  })
}
