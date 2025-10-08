/**
 * Phase 7: Comments Module Tests
 * Tests service/policy/repo layers with mocked providers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as comments from '@/modules/comments'
import type { CommentVisibility } from '@/modules/comments'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticketComment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/modules/tickets', () => ({
  service: {
    get: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import * as tickets from '@/modules/tickets'

describe('Phase 7: Comments Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Domain Types', () => {
    it('should export CommentDTO type', () => {
      expect(comments).toHaveProperty('CommentVisibilityEnum')
    })

    it('should export CommentVisibility type', () => {
      const visibility: CommentVisibility = 'public'
      expect(['public', 'internal']).toContain(visibility)
    })

    it('should export CreateCommentInput type', () => {
      const input: comments.CreateCommentInput = {
        content: 'Test comment',
        visibility: 'public',
      }
      expect(input.content).toBe('Test comment')
    })
  })

  describe('Policy Layer', () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@test.com',
      roles: ['Admin'],
    }

    const staffUser = {
      id: 'staff-1',
      email: 'staff@test.com',
      roles: ['Staff'],
    }

    const clientUser = {
      id: 'client-1',
      email: 'client@test.com',
      roles: ['Client'],
    }

    const ticket = {
      id: 'ticket-1',
      requesterId: 'client-1',
    }

    describe('canCreate', () => {
      it('should allow ADMIN to create public comment', () => {
        const result = comments.policy.canCreate(adminUser, ticket, 'public')
        expect(result).toBe(true)
      })

      it('should allow ADMIN to create internal comment', () => {
        const result = comments.policy.canCreate(adminUser, ticket, 'internal')
        expect(result).toBe(true)
      })

      it('should allow STAFF to create internal comment', () => {
        const result = comments.policy.canCreate(staffUser, ticket, 'internal')
        expect(result).toBe(true)
      })

      it('should allow CLIENT to create public comment on own ticket', () => {
        const result = comments.policy.canCreate(clientUser, ticket, 'public')
        expect(result).toBe(true)
      })

      it('should deny CLIENT creating internal comment', () => {
        const result = comments.policy.canCreate(clientUser, ticket, 'internal')
        expect(result).toBe(false)
      })

      it('should deny CLIENT creating comment on ticket they do not own', () => {
        const otherTicket = {
          id: 'ticket-2',
          requesterId: 'other-user',
        }
        const result = comments.policy.canCreate(clientUser, otherTicket, 'public')
        expect(result).toBe(false)
      })

      it('should deny user with no roles', () => {
        const noRolesUser = {
          id: 'user-1',
          email: 'user@test.com',
          roles: [],
        }
        const result = comments.policy.canCreate(noRolesUser, ticket, 'public')
        expect(result).toBe(false)
      })
    })

    describe('canRead', () => {
      it('should allow ADMIN to read internal comment', () => {
        const result = comments.policy.canRead(adminUser, ticket, 'internal')
        expect(result).toBe(true)
      })

      it('should allow STAFF to read internal comment', () => {
        const result = comments.policy.canRead(staffUser, ticket, 'internal')
        expect(result).toBe(true)
      })

      it('should allow CLIENT to read public comment on own ticket', () => {
        const result = comments.policy.canRead(clientUser, ticket, 'public')
        expect(result).toBe(true)
      })

      it('should deny CLIENT reading internal comment', () => {
        const result = comments.policy.canRead(clientUser, ticket, 'internal')
        expect(result).toBe(false)
      })

      it('should deny CLIENT reading comment on ticket they do not own', () => {
        const otherTicket = {
          id: 'ticket-2',
          requesterId: 'other-user',
        }
        const result = comments.policy.canRead(clientUser, otherTicket, 'public')
        expect(result).toBe(false)
      })
    })
  })

  describe('Repository Layer', () => {
    const mockPrismaComment = {
      id: 'comment-1',
      ticketId: 'ticket-1',
      userId: 'user-1',
      content: 'Test comment',
      isPublic: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      user: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
      },
    }

    it('should create public comment', async () => {
      vi.mocked(prisma.ticketComment.create).mockResolvedValue(mockPrismaComment)

      const result = await comments.repo.create('ticket-1', 'user-1', 'Test comment', 'public')

      expect(prisma.ticketComment.create).toHaveBeenCalledWith({
        data: {
          ticketId: 'ticket-1',
          userId: 'user-1',
          content: 'Test comment',
          isPublic: true,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      })

      expect(result.visibility).toBe('public')
      expect(result.content).toBe('Test comment')
    })

    it('should create internal comment', async () => {
      const internalComment = { ...mockPrismaComment, isPublic: false }
      vi.mocked(prisma.ticketComment.create).mockResolvedValue(internalComment)

      const result = await comments.repo.create('ticket-1', 'user-1', 'Internal note', 'internal')

      expect(prisma.ticketComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPublic: false,
          }),
        })
      )

      expect(result.visibility).toBe('internal')
    })

    it('should list all comments when includeInternal is true', async () => {
      vi.mocked(prisma.ticketComment.findMany).mockResolvedValue([
        mockPrismaComment,
        { ...mockPrismaComment, id: 'comment-2', isPublic: false },
      ])

      const result = await comments.repo.listByTicket('ticket-1', { includeInternal: true })

      expect(prisma.ticketComment.findMany).toHaveBeenCalledWith({
        where: {
          ticketId: 'ticket-1',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      expect(result).toHaveLength(2)
    })

    it('should list only public comments when includeInternal is false', async () => {
      vi.mocked(prisma.ticketComment.findMany).mockResolvedValue([mockPrismaComment])

      const result = await comments.repo.listByTicket('ticket-1', { includeInternal: false })

      expect(prisma.ticketComment.findMany).toHaveBeenCalledWith({
        where: {
          ticketId: 'ticket-1',
          isPublic: true,
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      })

      expect(result).toHaveLength(1)
      expect(result[0].visibility).toBe('public')
    })

    it('should map Prisma comment to CommentDTO with aliases', async () => {
      vi.mocked(prisma.ticketComment.create).mockResolvedValue(mockPrismaComment)

      const result = await comments.repo.create('ticket-1', 'user-1', 'Test', 'public')

      expect(result.userId).toBe(result.authorId)
      expect(result.content).toBe(result.body)
    })
  })

  describe('Service Layer', () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@test.com',
      roles: ['Admin'],
    }

    const clientUser = {
      id: 'client-1',
      email: 'client@test.com',
      roles: ['Client'],
    }

    const mockTicket = {
      id: 'ticket-1',
      requesterId: 'client-1',
      title: 'Test Ticket',
      description: 'Test',
      status: 'open' as const,
      priority: 'medium' as const,
      categoryId: null,
      assignedToId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockComment = {
      id: 'comment-1',
      ticketId: 'ticket-1',
      userId: 'user-1',
      authorId: 'user-1',
      content: 'Test comment',
      body: 'Test comment',
      visibility: 'public' as CommentVisibility,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
      },
    }

    describe('add', () => {
      beforeEach(() => {
        vi.mocked(tickets.service.get).mockImplementation(async (user, ticketId) => mockTicket)
        vi.mocked(prisma.ticketComment.create).mockResolvedValue({
          id: 'comment-1',
          ticketId: 'ticket-1',
          userId: 'admin-1',
          content: 'Test comment',
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: 'admin-1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@test.com',
          },
        })
      })

      it('should allow ADMIN to add public comment', async () => {
        const result = await comments.service.add('ticket-1', adminUser, {
          content: 'Test comment',
          visibility: 'public',
        })

        expect(result.content).toBe('Test comment')
        expect(result.visibility).toBe('public')
      })

      it('should allow ADMIN to add internal comment', async () => {
        vi.mocked(prisma.ticketComment.create).mockResolvedValue({
          id: 'comment-1',
          ticketId: 'ticket-1',
          userId: 'admin-1',
          content: 'Internal note',
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: 'admin-1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@test.com',
          },
        })

        const result = await comments.service.add('ticket-1', adminUser, {
          content: 'Internal note',
          visibility: 'internal',
        })

        expect(result.visibility).toBe('internal')
      })

      it('should allow CLIENT to add public comment on own ticket', async () => {
        vi.mocked(prisma.ticketComment.create).mockResolvedValue({
          id: 'comment-1',
          ticketId: 'ticket-1',
          userId: 'client-1',
          content: 'My comment',
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: 'client-1',
            firstName: 'Client',
            lastName: 'User',
            email: 'client@test.com',
          },
        })

        const result = await comments.service.add('ticket-1', clientUser, {
          content: 'My comment',
        })

        expect(result.content).toBe('My comment')
      })

      it('should throw error when CLIENT tries to add internal comment', async () => {
        await expect(
          comments.service.add('ticket-1', clientUser, {
            content: 'Internal note',
            visibility: 'internal',
          })
        ).rejects.toThrow('Forbidden')
      })

      it('should throw error when ticket not found', async () => {
        vi.mocked(tickets.service.get).mockImplementation(async () => null)

        await expect(
          comments.service.add('nonexistent', adminUser, {
            content: 'Test',
          })
        ).rejects.toThrow('Ticket not found')
      })

      it('should support isInternal flag for backward compatibility', async () => {
        vi.mocked(prisma.ticketComment.create).mockResolvedValue({
          id: 'comment-1',
          ticketId: 'ticket-1',
          userId: 'admin-1',
          content: 'Internal',
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: 'admin-1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@test.com',
          },
        })

        const result = await comments.service.add('ticket-1', adminUser, {
          content: 'Internal',
          isInternal: true,
        })

        expect(result.visibility).toBe('internal')
      })
    })

    describe('list', () => {
      beforeEach(() => {
        vi.mocked(tickets.service.get).mockImplementation(async (user, ticketId) => mockTicket)
      })

      it('should allow ADMIN to see all comments (public + internal)', async () => {
        vi.mocked(prisma.ticketComment.findMany).mockResolvedValue([
          {
            id: 'comment-1',
            ticketId: 'ticket-1',
            userId: 'user-1',
            content: 'Public',
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              id: 'user-1',
              firstName: 'User',
              lastName: 'One',
              email: 'user1@test.com',
            },
          },
          {
            id: 'comment-2',
            ticketId: 'ticket-1',
            userId: 'user-2',
            content: 'Internal',
            isPublic: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              id: 'user-2',
              firstName: 'User',
              lastName: 'Two',
              email: 'user2@test.com',
            },
          },
        ])

        const result = await comments.service.list('ticket-1', adminUser)

        expect(result).toHaveLength(2)
        expect(result[0].visibility).toBe('public')
        expect(result[1].visibility).toBe('internal')
      })

      it('should allow CLIENT to see only public comments on own ticket', async () => {
        vi.mocked(prisma.ticketComment.findMany).mockResolvedValue([
          {
            id: 'comment-1',
            ticketId: 'ticket-1',
            userId: 'user-1',
            content: 'Public',
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              id: 'user-1',
              firstName: 'User',
              lastName: 'One',
              email: 'user1@test.com',
            },
          },
        ])

        const result = await comments.service.list('ticket-1', clientUser)

        expect(result).toHaveLength(1)
        expect(result[0].visibility).toBe('public')
        expect(prisma.ticketComment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              isPublic: true,
            }),
          })
        )
      })

      it('should throw error when CLIENT tries to list comments on ticket they do not own', async () => {
        const otherTicket = {
          ...mockTicket,
          requesterId: 'other-user',
        }
        vi.mocked(tickets.service.get).mockImplementation(async () => otherTicket)

        await expect(
          comments.service.list('ticket-1', clientUser)
        ).rejects.toThrow('Forbidden')
      })

      it('should throw error when ticket not found', async () => {
        vi.mocked(tickets.service.get).mockImplementation(async () => null)

        await expect(
          comments.service.list('nonexistent', adminUser)
        ).rejects.toThrow('Ticket not found')
      })
    })
  })

  describe('Module Exports', () => {
    it('should export domain types', () => {
      expect(comments).toHaveProperty('CommentVisibilityEnum')
    })

    it('should export service namespace', () => {
      expect(comments.service).toHaveProperty('add')
      expect(comments.service).toHaveProperty('list')
    })

    it('should export policy namespace', () => {
      expect(comments.policy).toHaveProperty('canCreate')
      expect(comments.policy).toHaveProperty('canRead')
    })

    it('should export repo namespace', () => {
      expect(comments.repo).toHaveProperty('create')
      expect(comments.repo).toHaveProperty('listByTicket')
    })
  })
})
