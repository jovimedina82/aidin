/**
 * Users Service
 * Phase 2 Scaffold + Phase 3 Partial Implementation
 */

import { prisma } from '@/lib/prisma.js'
import type {
  UserDTO,
  CreateUserDTO,
  UpdateUserDTO,
  UserFilters,
  UserListResult,
  Role,
} from './domain'

/**
 * Map Prisma user to UserDTO
 * Helper function for consistent mapping
 */
function mapPrismaUserToDTO(user: any): UserDTO {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    roles: user.roles?.map((r: any) => r.role.name) || [],
    isActive: user.isActive,
    avatar: user.avatar,
    azureId: user.azureId,
    managerId: user.managerId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

/**
 * Create a new user
 * TODO: Implement in Phase 3 - validate data, hash password, store in database
 */
export async function createUser(data: CreateUserDTO): Promise<UserDTO> {
  // TODO: Validate email uniqueness
  // TODO: Hash password if provided
  // TODO: Create user in database via repository
  // TODO: Assign default roles if not provided
  // TODO: Return created user
  throw new Error('NotImplemented: createUser() - Phase 3')
}

/**
 * Get user by ID
 * Phase 3: Thin wrapper over Prisma
 */
export async function getUserById(id: string): Promise<UserDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  })

  if (!user) {
    return null
  }

  return mapPrismaUserToDTO(user)
}

/**
 * Get user by email
 * Phase 3: Thin wrapper over Prisma
 */
export async function getUserByEmail(email: string): Promise<UserDTO | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  })

  if (!user) {
    return null
  }

  return mapPrismaUserToDTO(user)
}

/**
 * List users with filters and pagination
 * TODO: Implement in Phase 3 - query with filters via repository
 */
export async function listUsers(
  filters: UserFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<UserListResult> {
  // TODO: Apply filters (roles, isActive, search, etc.)
  // TODO: Implement pagination
  // TODO: Count total matching users
  // TODO: Return paginated result
  throw new Error('NotImplemented: listUsers() - Phase 3')
}

/**
 * Update user
 * TODO: Implement in Phase 3 - validate and update via repository
 */
export async function updateUser(id: string, data: UpdateUserDTO): Promise<UserDTO> {
  // TODO: Validate user exists
  // TODO: Validate email uniqueness if changed
  // TODO: Update user in database
  // TODO: Return updated user
  throw new Error('NotImplemented: updateUser() - Phase 3')
}

/**
 * Delete user (soft delete - set isActive = false)
 * TODO: Implement in Phase 3 - check dependencies and soft delete
 */
export async function deleteUser(id: string): Promise<void> {
  // TODO: Check if user has open tickets or dependencies
  // TODO: Reassign tickets if needed
  // TODO: Soft delete (set isActive = false)
  throw new Error('NotImplemented: deleteUser() - Phase 3')
}

/**
 * Assign roles to user
 * TODO: Implement in Phase 3 - update user roles
 */
export async function assignRoles(userId: string, roles: Role[]): Promise<UserDTO> {
  // TODO: Validate user exists
  // TODO: Validate roles are valid
  // TODO: Update user roles in database
  // TODO: Return updated user
  throw new Error('NotImplemented: assignRoles() - Phase 3')
}

/**
 * Get user's direct reports (subordinates)
 * TODO: Implement in Phase 3 - fetch users where managerId = userId
 */
export async function getDirectReports(userId: string): Promise<UserDTO[]> {
  // TODO: Query users with managerId = userId
  // TODO: Return list of subordinates
  throw new Error('NotImplemented: getDirectReports() - Phase 3')
}

/**
 * Get user's manager chain (hierarchy up to root)
 * TODO: Implement in Phase 3 - recursively fetch managers
 */
export async function getManagerChain(userId: string): Promise<UserDTO[]> {
  // TODO: Recursively fetch manager -> manager -> ... until root
  // TODO: Return array from immediate manager to top
  throw new Error('NotImplemented: getManagerChain() - Phase 3')
}
