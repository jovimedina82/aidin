/**
 * Role-Based Access Control
 * Phase 3 Implementation - Real RBAC with role-to-permission matrix
 */

import type { UserDTO, Role } from './domain'

export enum Action {
  // User actions
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_ASSIGN_ROLES = 'user:assign_roles',

  // Ticket actions
  TICKET_CREATE = 'ticket:create',
  TICKET_READ = 'ticket:read',
  TICKET_READ_ANY = 'ticket:read:any', // Can read any ticket
  TICKET_READ_OWN = 'ticket:read:own', // Can only read own tickets
  TICKET_UPDATE = 'ticket:update',
  TICKET_DELETE = 'ticket:delete',
  TICKET_ASSIGN = 'ticket:assign',
  TICKET_CLOSE = 'ticket:close',

  // Admin actions
  ADMIN_SETTINGS = 'admin:settings',
  ADMIN_REPORTS = 'admin:reports',
  ADMIN_SYSTEM = 'admin:system',
}

/**
 * RBAC Matrix: Maps roles to their permitted actions
 * Phase 3: Based on user specification
 * - ADMIN: all permissions
 * - STAFF: ticket:create, ticket:read:any
 * - CLIENT: ticket:create, ticket:read:own
 */
const ROLE_PERMISSIONS: Record<string, Action[]> = {
  Admin: [
    // Admins can do everything
    Action.USER_CREATE,
    Action.USER_READ,
    Action.USER_UPDATE,
    Action.USER_DELETE,
    Action.USER_ASSIGN_ROLES,
    Action.TICKET_CREATE,
    Action.TICKET_READ,
    Action.TICKET_READ_ANY,
    Action.TICKET_READ_OWN,
    Action.TICKET_UPDATE,
    Action.TICKET_DELETE,
    Action.TICKET_ASSIGN,
    Action.TICKET_CLOSE,
    Action.ADMIN_SETTINGS,
    Action.ADMIN_REPORTS,
    Action.ADMIN_SYSTEM,
  ],
  Staff: [
    // Staff can create tickets and view any ticket
    Action.TICKET_CREATE,
    Action.TICKET_READ,
    Action.TICKET_READ_ANY,
    Action.TICKET_UPDATE,
    Action.TICKET_ASSIGN,
    Action.TICKET_CLOSE,
    Action.USER_READ,
  ],
  Client: [
    // Clients can create tickets and view only their own tickets
    Action.TICKET_CREATE,
    Action.TICKET_READ,
    Action.TICKET_READ_OWN,
  ],
  Manager: [
    // Managers have same permissions as Staff plus user management
    Action.TICKET_CREATE,
    Action.TICKET_READ,
    Action.TICKET_READ_ANY,
    Action.TICKET_UPDATE,
    Action.TICKET_ASSIGN,
    Action.TICKET_CLOSE,
    Action.USER_READ,
    Action.USER_UPDATE,
    Action.ADMIN_REPORTS,
  ],
}

/**
 * Check if user can perform action
 * Phase 3: Implements real RBAC based on role-permission matrix
 * @param user - User object with roles
 * @param action - Action to check permission for
 * @returns true if user has permission, false otherwise
 */
export function can(user: UserDTO, action: Action): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  // Check if any of the user's roles grant the permission
  for (const role of user.roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || []
    if (rolePermissions.includes(action)) {
      return true
    }
  }

  return false
}

/**
 * Check if user can perform action on specific resource
 * Phase 3: Implements ownership and context checking
 * @param user - User object with roles
 * @param action - Action to check permission for
 * @param resource - Resource object (e.g., ticket with requesterId)
 * @returns true if user has permission, false otherwise
 */
export function canOn(user: UserDTO, action: Action, resource: any): boolean {
  // First check basic permission
  if (!can(user, action)) {
    return false
  }

  // For TICKET_READ_OWN, check ownership
  if (action === Action.TICKET_READ || action === Action.TICKET_READ_OWN) {
    // If user has TICKET_READ_ANY, they can view any ticket
    if (can(user, Action.TICKET_READ_ANY)) {
      return true
    }

    // Otherwise, check if they own the ticket
    if (resource && resource.requesterId === user.id) {
      return true
    }

    return false
  }

  // For other actions, if they have the basic permission, allow it
  return true
}

/**
 * Check if user has any of the specified roles
 * Phase 3: Real role checking implementation
 * @param user - User object with roles
 * @param roles - Array of roles to check
 * @returns true if user has at least one of the roles
 */
export function hasRole(user: UserDTO, roles: Role[]): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  return user.roles.some((userRole) => roles.includes(userRole))
}

/**
 * Check if user has all of the specified roles
 * Phase 3: Real role checking implementation
 * @param user - User object with roles
 * @param roles - Array of roles to check
 * @returns true if user has all of the roles
 */
export function hasAllRoles(user: UserDTO, roles: Role[]): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  return roles.every((role) => user.roles.includes(role))
}

/**
 * Get all actions a user can perform
 * Phase 3: Returns list of permitted actions based on user's roles
 * @param user - User object with roles
 * @returns Array of actions user can perform
 */
export function getUserPermissions(user: UserDTO): Action[] {
  if (!user || !user.roles || user.roles.length === 0) {
    return []
  }

  const permissions = new Set<Action>()

  // Collect permissions from all user roles
  for (const role of user.roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || []
    rolePermissions.forEach((perm) => permissions.add(perm))
  }

  return Array.from(permissions)
}
