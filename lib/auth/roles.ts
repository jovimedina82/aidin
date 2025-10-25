// Role hierarchy and utilities
export type Role = 'requester' | 'staff' | 'manager' | 'admin';

export const roleRank: Record<Role, number> = {
  requester: 0,
  staff: 1,
  manager: 2,
  admin: 3,
};

/**
 * Check if a user role meets or exceeds the required role level
 * @param userRole - The user's current role
 * @param required - The minimum required role
 * @returns true if user has sufficient permissions
 */
export function atLeast(userRole: Role, required: Role): boolean {
  return roleRank[userRole] >= roleRank[required];
}

/**
 * Check if a role string is a valid Role type
 */
export function isValidRole(role: string): role is Role {
  return role in roleRank;
}
