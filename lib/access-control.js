import { prisma } from '@/lib/prisma'

/**
 * Check if a user has access to a specific ticket based on role-based permissions
 * @param {Object} user - The current user object with roles
 * @param {Object} ticket - The ticket object to check access for
 * @returns {Promise<boolean>} - Whether the user has access
 */
export async function hasTicketAccess(user, ticket) {
  if (!user || !ticket) return false

  // Get user roles
  const userRoles = user?.roles || []
  const roleNames = userRoles.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  )

  const isAdmin = roleNames.includes('Admin')
  const isManager = roleNames.includes('Manager')
  const isStaff = roleNames.includes('Staff')

  // Admins can access any ticket
  if (isAdmin) {
    return true
  }

  // Users can access tickets they created or are assigned to
  if (ticket.requesterId === user.id || ticket.assigneeId === user.id) {
    return true
  }

  // For managers and staff, check department access
  if (isManager || isStaff) {
    const userWithDepartments = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        departments: {
          include: {
            department: true
          }
        }
      }
    })

    const userDepartmentNames = userWithDepartments?.departments?.map(ud => ud.department.name) || []

    // Check if ticket category matches user's departments
    if (userDepartmentNames.includes(ticket.category)) {
      return true
    }
  }

  return false
}

/**
 * Build a where clause for ticket queries based on user permissions
 * @param {Object} user - The current user object with roles
 * @returns {Promise<Object>} - Prisma where clause object
 */
export async function buildTicketAccessWhere(user) {
  if (!user) return { id: 'never-match' } // Ensures no results for unauthenticated users

  // Get user roles
  const userRoles = user?.roles || []
  const roleNames = userRoles.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  )

  const isAdmin = roleNames.includes('Admin')
  const isManager = roleNames.includes('Manager')
  const isStaff = roleNames.includes('Staff')

  // Admins can see all tickets
  if (isAdmin) {
    return {}
  }

  // For managers and staff, get their departments
  if (isManager || isStaff) {
    const userWithDepartments = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        departments: {
          include: {
            department: true
          }
        }
      }
    })

    const userDepartmentNames = userWithDepartments?.departments?.map(ud => ud.department.name) || []

    if (isManager) {
      // Managers can see:
      // 1. Their own tickets (created or assigned)
      // 2. All tickets in their departments
      return {
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id },
          { category: { in: userDepartmentNames } }
        ]
      }
    } else if (isStaff) {
      // Staff can see:
      // 1. Their own tickets (created or assigned)
      // 2. Unassigned tickets in their departments
      // 3. Tickets assigned to them in their departments
      return {
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id },
          {
            AND: [
              { category: { in: userDepartmentNames } },
              {
                OR: [
                  { assigneeId: null },
                  { assigneeId: user.id }
                ]
              }
            ]
          }
        ]
      }
    }
  }

  // Requesters/Clients can only see their own tickets
  return {
    OR: [
      { requesterId: user.id },
      { assigneeId: user.id }
    ]
  }
}

/**
 * Check if a user can assign tickets in a specific department
 * @param {Object} user - The current user object with roles
 * @param {string} department - The department name
 * @returns {Promise<boolean>} - Whether the user can assign tickets in this department
 */
export async function canAssignTickets(user, department) {
  if (!user) return false

  const userRoles = user?.roles || []
  const roleNames = userRoles.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  )

  const isAdmin = roleNames.includes('Admin')
  const isManager = roleNames.includes('Manager')

  // Admins can assign any ticket
  if (isAdmin) {
    return true
  }

  // Managers can assign tickets in their departments
  if (isManager) {
    const userWithDepartments = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        departments: {
          include: {
            department: true
          }
        }
      }
    })

    const userDepartmentNames = userWithDepartments?.departments?.map(ud => ud.department.name) || []
    return userDepartmentNames.includes(department)
  }

  return false
}

/**
 * Check if a user can take (self-assign) a ticket
 * @param {Object} user - The current user object with roles
 * @param {Object} ticket - The ticket object
 * @returns {Promise<boolean>} - Whether the user can take this ticket
 */
export async function canTakeTicket(user, ticket) {
  if (!user || !ticket) return false

  // Can't take tickets that are already assigned
  if (ticket.assigneeId) return false

  const userRoles = user?.roles || []
  const roleNames = userRoles.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  )

  const isAdmin = roleNames.includes('Admin')
  const isManager = roleNames.includes('Manager')
  const isStaff = roleNames.includes('Staff')

  // Staff cannot take tickets they created themselves
  if (isStaff && !isAdmin && ticket.requesterId === user.id) {
    return false
  }

  // Admins can take any ticket
  if (isAdmin) {
    return true
  }

  // Managers and staff can take tickets in their departments
  if (isManager || isStaff) {
    const userWithDepartments = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        departments: {
          include: {
            department: true
          }
        }
      }
    })

    const userDepartmentNames = userWithDepartments?.departments?.map(ud => ud.department.name) || []
    return userDepartmentNames.includes(ticket.category)
  }

  return false
}