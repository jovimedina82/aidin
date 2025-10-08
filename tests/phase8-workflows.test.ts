/**
 * Phase 8: Workflows Tests
 * Tests status transitions and auto-assignment workflows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as workflows from '@/modules/tickets/workflows'
import * as policy from '@/modules/tickets/policy'
import * as repo from '@/modules/tickets/repo'
import { Status, TicketDTO } from '@/modules/tickets/domain'

// Mock dependencies
vi.mock('@/modules/tickets/repo', () => ({
  updateStatus: vi.fn(),
  updateAssignee: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
}))

vi.mock('@/lib/config', () => ({
  config: {
    AUTO_ASSIGN_ENABLED: false,
  },
}))

import { config } from '@/lib/config'

describe('Phase 8: Workflows Module', () => {
  const adminUser: policy.PolicyUser = {
    id: 'admin-1',
    email: 'admin@test.com',
    roles: ['Admin'],
  }

  const staffUser: policy.PolicyUser = {
    id: 'staff-1',
    email: 'staff@test.com',
    roles: ['Staff'],
  }

  const clientUser: policy.PolicyUser = {
    id: 'client-1',
    email: 'client@test.com',
    roles: ['Client'],
  }

  const mockTicket: TicketDTO = {
    id: 'ticket-1',
    ticketNumber: 'T-20251008-0001',
    title: 'Test Ticket',
    description: 'Test',
    status: Status.OPEN,
    priority: 'NORMAL' as any,
    requesterId: 'client-1',
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset config
    ;(config as any).AUTO_ASSIGN_ENABLED = false
  })

  describe('Transition Map', () => {
    it('should allow NEW → OPEN transition', () => {
      expect(workflows.isValidTransition(Status.NEW, Status.OPEN)).toBe(true)
    })

    it('should allow NEW → CLOSED transition', () => {
      expect(workflows.isValidTransition(Status.NEW, Status.CLOSED)).toBe(true)
    })

    it('should allow OPEN → PENDING transition', () => {
      expect(workflows.isValidTransition(Status.OPEN, Status.PENDING)).toBe(true)
    })

    it('should allow OPEN → SOLVED transition', () => {
      expect(workflows.isValidTransition(Status.OPEN, Status.SOLVED)).toBe(true)
    })

    it('should allow SOLVED → CLOSED transition', () => {
      expect(workflows.isValidTransition(Status.SOLVED, Status.CLOSED)).toBe(true)
    })

    it('should NOT allow CLOSED → OPEN transition', () => {
      expect(workflows.isValidTransition(Status.CLOSED, Status.OPEN)).toBe(false)
    })

    it('should NOT allow NEW → PENDING transition', () => {
      expect(workflows.isValidTransition(Status.NEW, Status.PENDING)).toBe(false)
    })

    it('should NOT allow PENDING → CLOSED transition', () => {
      expect(workflows.isValidTransition(Status.PENDING, Status.CLOSED)).toBe(false)
    })
  })

  describe('transition()', () => {
    it('should allow STAFF to transition OPEN → PENDING', async () => {
      const updatedTicket = { ...mockTicket, status: Status.PENDING }
      vi.mocked(repo.updateStatus).mockResolvedValue(updatedTicket)

      const result = await workflows.transition(staffUser, mockTicket, Status.PENDING)

      expect(repo.updateStatus).toHaveBeenCalledWith(
        mockTicket.id,
        Status.PENDING,
        {}
      )
      expect(result.status).toBe(Status.PENDING)
    })

    it('should set resolvedAt when transitioning TO SOLVED', async () => {
      const updatedTicket = {
        ...mockTicket,
        status: Status.SOLVED,
        resolvedAt: new Date(),
      }
      vi.mocked(repo.updateStatus).mockResolvedValue(updatedTicket)

      await workflows.transition(staffUser, mockTicket, Status.SOLVED)

      expect(repo.updateStatus).toHaveBeenCalledWith(
        mockTicket.id,
        Status.SOLVED,
        expect.objectContaining({
          resolvedAt: expect.any(Date),
        })
      )
    })

    it('should clear resolvedAt when transitioning OFF SOLVED', async () => {
      const solvedTicket = {
        ...mockTicket,
        status: Status.SOLVED,
        resolvedAt: new Date(),
      }
      const updatedTicket = { ...solvedTicket, status: Status.OPEN, resolvedAt: null }
      vi.mocked(repo.updateStatus).mockResolvedValue(updatedTicket as any)

      await workflows.transition(staffUser, solvedTicket, Status.OPEN)

      expect(repo.updateStatus).toHaveBeenCalledWith(
        solvedTicket.id,
        Status.OPEN,
        { resolvedAt: null }
      )
    })

    it('should allow CLIENT to close own ticket', async () => {
      const updatedTicket = { ...mockTicket, status: Status.CLOSED }
      vi.mocked(repo.updateStatus).mockResolvedValue(updatedTicket)

      const result = await workflows.transition(clientUser, mockTicket, Status.CLOSED)

      expect(result.status).toBe(Status.CLOSED)
    })

    it('should reject CLIENT changing own ticket to PENDING', async () => {
      await expect(
        workflows.transition(clientUser, mockTicket, Status.PENDING)
      ).rejects.toThrow('Forbidden')
    })

    it('should reject CLIENT changing another user ticket', async () => {
      const otherTicket = { ...mockTicket, requesterId: 'other-user' }

      await expect(
        workflows.transition(clientUser, otherTicket, Status.CLOSED)
      ).rejects.toThrow('Forbidden')
    })

    it('should reject invalid transition CLOSED → OPEN', async () => {
      const closedTicket = { ...mockTicket, status: Status.CLOSED }

      await expect(
        workflows.transition(staffUser, closedTicket, Status.OPEN)
      ).rejects.toThrow('Invalid transition')
    })
  })

  describe('autoAssign()', () => {
    it('should return ticket unchanged when AUTO_ASSIGN_ENABLED is false', async () => {
      const result = await workflows.autoAssign(staffUser, mockTicket)

      expect(result).toBe(mockTicket)
      expect(repo.updateAssignee).not.toHaveBeenCalled()
    })

    it('should return ticket unchanged when already assigned', async () => {
      ;(config as any).AUTO_ASSIGN_ENABLED = true
      const assignedTicket = { ...mockTicket, assigneeId: 'agent-1' }

      const result = await workflows.autoAssign(staffUser, assignedTicket)

      expect(result).toBe(assignedTicket)
      expect(repo.updateAssignee).not.toHaveBeenCalled()
    })

    it('should assign to mock agent when AUTO_ASSIGN_ENABLED is true and no assignee', async () => {
      ;(config as any).AUTO_ASSIGN_ENABLED = true
      const assignedTicket = { ...mockTicket, assigneeId: 'auto-assigned-agent-1' }
      vi.mocked(repo.updateAssignee).mockResolvedValue(assignedTicket)

      const result = await workflows.autoAssign(staffUser, mockTicket)

      expect(repo.updateAssignee).toHaveBeenCalledWith(
        mockTicket.id,
        'auto-assigned-agent-1'
      )
      expect(result.assigneeId).toBe('auto-assigned-agent-1')
    })
  })

  describe('assign()', () => {
    it('should allow STAFF to assign ticket', async () => {
      const assignedTicket = { ...mockTicket, assigneeId: 'agent-1' }
      vi.mocked(repo.updateAssignee).mockResolvedValue(assignedTicket)

      const result = await workflows.assign(staffUser, mockTicket, 'agent-1')

      expect(repo.updateAssignee).toHaveBeenCalledWith(mockTicket.id, 'agent-1')
      expect(result.assigneeId).toBe('agent-1')
    })

    it('should allow ADMIN to assign ticket', async () => {
      const assignedTicket = { ...mockTicket, assigneeId: 'agent-2' }
      vi.mocked(repo.updateAssignee).mockResolvedValue(assignedTicket)

      const result = await workflows.assign(adminUser, mockTicket, 'agent-2')

      expect(result.assigneeId).toBe('agent-2')
    })

    it('should allow STAFF to unassign ticket (set to null)', async () => {
      const assignedTicket = { ...mockTicket, assigneeId: 'agent-1' }
      const unassignedTicket = { ...assignedTicket, assigneeId: null }
      vi.mocked(repo.updateAssignee).mockResolvedValue(unassignedTicket)

      const result = await workflows.assign(staffUser, assignedTicket, null)

      expect(repo.updateAssignee).toHaveBeenCalledWith(assignedTicket.id, null)
      expect(result.assigneeId).toBe(null)
    })

    it('should reject CLIENT trying to assign ticket', async () => {
      await expect(
        workflows.assign(clientUser, mockTicket, 'agent-1')
      ).rejects.toThrow('Forbidden')
    })
  })

  describe('Policy Integration', () => {
    describe('canTransition', () => {
      it('should allow ADMIN to transition any ticket', () => {
        expect(policy.canTransition(adminUser, mockTicket, Status.PENDING)).toBe(true)
        expect(policy.canTransition(adminUser, mockTicket, Status.SOLVED)).toBe(true)
      })

      it('should allow STAFF to transition any ticket', () => {
        expect(policy.canTransition(staffUser, mockTicket, Status.ON_HOLD)).toBe(true)
      })

      it('should only allow CLIENT to close own ticket', () => {
        expect(policy.canTransition(clientUser, mockTicket, Status.CLOSED)).toBe(true)
        expect(policy.canTransition(clientUser, mockTicket, Status.PENDING)).toBe(false)
      })

      it('should reject CLIENT closing ticket they do not own', () => {
        const otherTicket = { ...mockTicket, requesterId: 'other-user' }
        expect(policy.canTransition(clientUser, otherTicket, Status.CLOSED)).toBe(false)
      })
    })

    describe('canAssign', () => {
      it('should allow ADMIN to assign', () => {
        expect(policy.canAssign(adminUser, mockTicket, 'agent-1')).toBe(true)
      })

      it('should allow STAFF to assign', () => {
        expect(policy.canAssign(staffUser, mockTicket, 'agent-1')).toBe(true)
      })

      it('should reject CLIENT assigning', () => {
        expect(policy.canAssign(clientUser, mockTicket, 'agent-1')).toBe(false)
      })
    })
  })

  describe('Workflow Exports', () => {
    it('should export transition function', () => {
      expect(workflows.transition).toBeDefined()
      expect(typeof workflows.transition).toBe('function')
    })

    it('should export autoAssign function', () => {
      expect(workflows.autoAssign).toBeDefined()
      expect(typeof workflows.autoAssign).toBe('function')
    })

    it('should export assign function', () => {
      expect(workflows.assign).toBeDefined()
      expect(typeof workflows.assign).toBe('function')
    })

    it('should export isValidTransition function', () => {
      expect(workflows.isValidTransition).toBeDefined()
      expect(typeof workflows.isValidTransition).toBe('function')
    })

    it('should export ALLOWED_TRANSITIONS map', () => {
      expect(workflows.ALLOWED_TRANSITIONS).toBeDefined()
      expect(workflows.ALLOWED_TRANSITIONS[Status.NEW]).toContain(Status.OPEN)
    })
  })
})
