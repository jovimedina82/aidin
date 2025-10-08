/**
 * Phase 3 - Auth & RBAC Tests
 * Tests for authentication middleware and role-based access control
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { auth, users } from '@/modules'
import type { UserDTO } from '@/modules/users/domain'

describe('Phase 3 - Auth & RBAC', () => {
  // Test data
  const mockAdminUser: UserDTO = {
    id: '1',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['Admin' as users.Role],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockStaffUser: UserDTO = {
    id: '2',
    email: 'staff@test.com',
    firstName: 'Staff',
    lastName: 'User',
    roles: ['Staff' as users.Role],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockClientUser: UserDTO = {
    id: '3',
    email: 'client@test.com',
    firstName: 'Client',
    lastName: 'User',
    roles: ['Client' as users.Role],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('JWT Token Helpers', () => {
    it('should sign a token with user data', () => {
      const authUser: auth.AuthUser = {
        id: '1',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        roles: ['Admin'],
        provider: auth.Provider.LOCAL,
      }

      const tokenPair = auth.jwt.signToken(authUser)

      expect(tokenPair).toBeDefined()
      expect(tokenPair.accessToken).toBeDefined()
      expect(typeof tokenPair.accessToken).toBe('string')
      expect(tokenPair.expiresIn).toBeGreaterThan(0)
    })

    it('should verify and decode a valid token', () => {
      const authUser: auth.AuthUser = {
        id: '1',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        roles: ['Admin'],
        provider: auth.Provider.LOCAL,
      }

      const tokenPair = auth.jwt.signToken(authUser)
      const decoded = auth.jwt.verifyToken(tokenPair.accessToken)

      expect(decoded).not.toBeNull()
      expect(decoded?.userId).toBe('1')
      expect(decoded?.email).toBe('test@test.com')
      expect(decoded?.roles).toEqual(['Admin'])
    })

    it('should return null for invalid token', () => {
      const decoded = auth.jwt.verifyToken('invalid-token-12345')
      expect(decoded).toBeNull()
    })

    it('should extract token from Authorization header', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          Authorization: 'Bearer test-token-123',
        },
      })

      const token = auth.jwt.extractToken(request)
      expect(token).toBe('test-token-123')
    })

    it('should return null if no token in request', () => {
      const request = new Request('http://localhost:3000/api/test')
      const token = auth.jwt.extractToken(request)
      expect(token).toBeNull()
    })
  })

  describe('RBAC - Role Permissions Matrix', () => {
    describe('Admin role', () => {
      it('should have permission to create tickets', () => {
        expect(users.rbac.can(mockAdminUser, users.rbac.Action.TICKET_CREATE)).toBe(true)
      })

      it('should have permission to view any ticket', () => {
        expect(users.rbac.can(mockAdminUser, users.rbac.Action.TICKET_READ_ANY)).toBe(true)
      })

      it('should have permission to create users', () => {
        expect(users.rbac.can(mockAdminUser, users.rbac.Action.USER_CREATE)).toBe(true)
      })

      it('should have permission to access admin settings', () => {
        expect(users.rbac.can(mockAdminUser, users.rbac.Action.ADMIN_SETTINGS)).toBe(true)
      })
    })

    describe('Staff role', () => {
      it('should have permission to create tickets', () => {
        expect(users.rbac.can(mockStaffUser, users.rbac.Action.TICKET_CREATE)).toBe(true)
      })

      it('should have permission to view any ticket', () => {
        expect(users.rbac.can(mockStaffUser, users.rbac.Action.TICKET_READ_ANY)).toBe(true)
      })

      it('should NOT have permission to create users', () => {
        expect(users.rbac.can(mockStaffUser, users.rbac.Action.USER_CREATE)).toBe(false)
      })

      it('should NOT have permission to access admin settings', () => {
        expect(users.rbac.can(mockStaffUser, users.rbac.Action.ADMIN_SETTINGS)).toBe(false)
      })
    })

    describe('Client role', () => {
      it('should have permission to create tickets', () => {
        expect(users.rbac.can(mockClientUser, users.rbac.Action.TICKET_CREATE)).toBe(true)
      })

      it('should have permission to view own tickets', () => {
        expect(users.rbac.can(mockClientUser, users.rbac.Action.TICKET_READ_OWN)).toBe(true)
      })

      it('should NOT have permission to view any ticket', () => {
        expect(users.rbac.can(mockClientUser, users.rbac.Action.TICKET_READ_ANY)).toBe(false)
      })

      it('should NOT have permission to create users', () => {
        expect(users.rbac.can(mockClientUser, users.rbac.Action.USER_CREATE)).toBe(false)
      })
    })
  })

  describe('RBAC - Resource Ownership', () => {
    it('should allow client to view their own ticket', () => {
      const ticket = { id: 't1', requesterId: '3' } // Client user's ticket
      const result = users.rbac.canOn(
        mockClientUser,
        users.rbac.Action.TICKET_READ,
        ticket
      )
      expect(result).toBe(true)
    })

    it('should deny client from viewing other user\'s ticket', () => {
      const ticket = { id: 't1', requesterId: '999' } // Not client's ticket
      const result = users.rbac.canOn(
        mockClientUser,
        users.rbac.Action.TICKET_READ,
        ticket
      )
      expect(result).toBe(false)
    })

    it('should allow staff to view any ticket', () => {
      const ticket = { id: 't1', requesterId: '999' }
      const result = users.rbac.canOn(
        mockStaffUser,
        users.rbac.Action.TICKET_READ,
        ticket
      )
      expect(result).toBe(true)
    })

    it('should allow admin to view any ticket', () => {
      const ticket = { id: 't1', requesterId: '999' }
      const result = users.rbac.canOn(
        mockAdminUser,
        users.rbac.Action.TICKET_READ,
        ticket
      )
      expect(result).toBe(true)
    })
  })

  describe('RBAC - Role Checking Helpers', () => {
    it('hasRole should return true if user has the role', () => {
      expect(users.rbac.hasRole(mockAdminUser, ['Admin' as users.Role])).toBe(true)
    })

    it('hasRole should return false if user does not have the role', () => {
      expect(users.rbac.hasRole(mockClientUser, ['Admin' as users.Role])).toBe(false)
    })

    it('hasRole should return true if user has any of the specified roles', () => {
      expect(
        users.rbac.hasRole(mockStaffUser, ['Admin' as users.Role, 'Staff' as users.Role])
      ).toBe(true)
    })

    it('hasAllRoles should return true if user has all roles', () => {
      const multiRoleUser: UserDTO = {
        ...mockAdminUser,
        roles: ['Admin' as users.Role, 'Staff' as users.Role],
      }
      expect(
        users.rbac.hasAllRoles(multiRoleUser, ['Admin' as users.Role, 'Staff' as users.Role])
      ).toBe(true)
    })

    it('hasAllRoles should return false if user is missing a role', () => {
      expect(
        users.rbac.hasAllRoles(mockStaffUser, ['Admin' as users.Role, 'Staff' as users.Role])
      ).toBe(false)
    })
  })

  describe('RBAC - Permission Listing', () => {
    it('should return all permissions for admin user', () => {
      const permissions = users.rbac.getUserPermissions(mockAdminUser)
      expect(permissions.length).toBeGreaterThan(0)
      expect(permissions).toContain(users.rbac.Action.TICKET_CREATE)
      expect(permissions).toContain(users.rbac.Action.USER_CREATE)
      expect(permissions).toContain(users.rbac.Action.ADMIN_SETTINGS)
    })

    it('should return limited permissions for client user', () => {
      const permissions = users.rbac.getUserPermissions(mockClientUser)
      expect(permissions).toContain(users.rbac.Action.TICKET_CREATE)
      expect(permissions).toContain(users.rbac.Action.TICKET_READ_OWN)
      expect(permissions).not.toContain(users.rbac.Action.USER_CREATE)
      expect(permissions).not.toContain(users.rbac.Action.ADMIN_SETTINGS)
    })

    it('should return empty array for user with no roles', () => {
      const noRoleUser: UserDTO = {
        ...mockClientUser,
        roles: [],
      }
      const permissions = users.rbac.getUserPermissions(noRoleUser)
      expect(permissions).toEqual([])
    })
  })

  describe('User Service Functions', () => {
    // Note: These tests require database access and may need to be skipped in CI
    // They are kept here for local testing with a test database

    it('should define getUserById function', () => {
      expect(users.service.getUserById).toBeDefined()
      expect(typeof users.service.getUserById).toBe('function')
    })

    it('should define getUserByEmail function', () => {
      expect(users.service.getUserByEmail).toBeDefined()
      expect(typeof users.service.getUserByEmail).toBe('function')
    })
  })

  describe('Module Exports', () => {
    it('should export auth module with all functions', () => {
      expect(auth).toBeDefined()
      expect(auth.jwt).toBeDefined()
      expect(auth.middleware).toBeDefined()
      expect(auth.Provider).toBeDefined()
    })

    it('should export users module with all functions', () => {
      expect(users).toBeDefined()
      expect(users.rbac).toBeDefined()
      expect(users.service).toBeDefined()
      expect(users.Role).toBeDefined()
    })

    it('should export middleware functions', () => {
      expect(auth.middleware.requireUser).toBeDefined()
      expect(auth.middleware.requireRoles).toBeDefined()
      expect(auth.middleware.requirePermissions).toBeDefined()
    })

    it('should export JWT helpers', () => {
      expect(auth.jwt.signToken).toBeDefined()
      expect(auth.jwt.verifyToken).toBeDefined()
      expect(auth.jwt.extractToken).toBeDefined()
    })

    it('should export RBAC functions', () => {
      expect(users.rbac.can).toBeDefined()
      expect(users.rbac.canOn).toBeDefined()
      expect(users.rbac.hasRole).toBeDefined()
      expect(users.rbac.hasAllRoles).toBeDefined()
      expect(users.rbac.getUserPermissions).toBeDefined()
    })

    it('should export Action enum with all actions', () => {
      expect(users.rbac.Action.TICKET_CREATE).toBe('ticket:create')
      expect(users.rbac.Action.TICKET_READ_ANY).toBe('ticket:read:any')
      expect(users.rbac.Action.TICKET_READ_OWN).toBe('ticket:read:own')
      expect(users.rbac.Action.USER_CREATE).toBe('user:create')
      expect(users.rbac.Action.ADMIN_SETTINGS).toBe('admin:settings')
    })
  })
})
