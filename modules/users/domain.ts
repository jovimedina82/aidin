/**
 * Users Domain Types and DTOs
 * Phase 2 Scaffold - Types only, no implementation
 */

export enum Role {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  STAFF = 'Staff',
  CLIENT = 'Client',
}

export interface UserDTO {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  roles: Role[]
  isActive: boolean
  avatar?: string
  azureId?: string
  managerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserDTO {
  email: string
  password?: string
  firstName: string
  lastName: string
  phone?: string
  roles?: Role[]
  managerId?: string
  azureId?: string
}

export interface UpdateUserDTO {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  isActive?: boolean
  avatar?: string
  managerId?: string
}

export interface UserFilters {
  roles?: Role[]
  isActive?: boolean
  managerId?: string
  search?: string
}

export interface UserListResult {
  users: UserDTO[]
  total: number
  page: number
  pageSize: number
}
