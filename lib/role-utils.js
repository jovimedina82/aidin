/**
 * Extract role names from user roles array
 * Handles both formats:
 * - Array of strings: ['Admin', 'Manager']
 * - Array of objects: [{role: {name: 'Admin'}}]
 */
export function extractRoleNames(roles) {
  if (!roles || !Array.isArray(roles)) {
    return []
  }

  return roles.map(role => {
    if (typeof role === 'string') {
      return role
    }
    return role.role?.name || role.name || null
  }).filter(Boolean)
}

/**
 * Check if user has specific role(s)
 * Case-insensitive comparison
 */
export function hasRole(user, roleName) {
  const userRoles = extractRoleNames(user?.roles).map(r => r.toUpperCase())
  if (Array.isArray(roleName)) {
    return roleName.some(r => userRoles.includes(r.toUpperCase()))
  }
  return userRoles.includes(roleName.toUpperCase())
}

/**
 * Check if user is admin
 */
export function isAdmin(user) {
  return hasRole(user, ['Admin', 'Manager'])
}

/**
 * Check if user is staff
 */
export function isStaff(user) {
  return hasRole(user, ['Admin', 'Manager', 'Staff'])
}

/**
 * Check if user is ONLY a Requester (no Staff/Manager/Admin roles)
 */
export function isRequester(user) {
  const userRoles = extractRoleNames(user?.roles).map(r => r.toUpperCase())
  const privilegedRoles = ['ADMIN', 'MANAGER', 'STAFF']
  return !userRoles.some(role => privilegedRoles.includes(role))
}

/**
 * Check if user can edit a specific user's schedule
 * @param {Object} user - Current user
 * @param {string} targetUserId - ID of user whose schedule is being edited
 * @returns {boolean}
 */
export function canEditSchedule(user, targetUserId) {
  if (!user) return false

  // Requesters cannot edit any schedule
  if (isRequester(user)) return false

  // Admins/Managers can edit any schedule
  if (isAdmin(user)) return true

  // Staff can edit only their own schedule
  return isStaff(user) && user.id === targetUserId
}
