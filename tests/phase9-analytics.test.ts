/**
 * Phase 9: Analytics & Weekly Reporting
 * Test Suite
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as reports from '@/modules/reports'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticket: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    weeklyKPI: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('Phase 9: Analytics & Weekly Reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Domain Types', () => {
    it('should export WeeklyKPI interface', () => {
      const kpi: reports.WeeklyKPI = {
        id: 'kpi-1',
        weekStartUTC: new Date('2025-10-06T00:00:00Z'),
        ticketsOpen: 10,
        ticketsPending: 5,
        ticketsSolved7d: 15,
        avgFirstResponseMinutes: 45,
        createdAt: new Date(),
      }
      expect(kpi.ticketsOpen).toBe(10)
    })

    it('should export KPISet interface', () => {
      const kpiSet: reports.KPISet = {
        tickets_open: 10,
        tickets_pending: 5,
        tickets_solved_7d: 15,
        avg_first_response_minutes: 45,
        computed_at: '2025-10-08T12:00:00Z',
      }
      expect(kpiSet.tickets_open).toBe(10)
    })
  })

  describe('service.computeKPIs()', () => {
    it('should compute KPIs with all zero values when no tickets exist', async () => {
      // Mock: No tickets
      vi.mocked(prisma.ticket.count).mockResolvedValue(0)
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([])

      const result = await reports.service.computeKPIs(new Date('2025-10-08T12:00:00Z'))

      expect(result).toMatchObject({
        tickets_open: 0,
        tickets_pending: 0,
        tickets_solved_7d: 0,
        avg_first_response_minutes: 0,
      })
      expect(result.computed_at).toBe('2025-10-08T12:00:00.000Z')
    })

    it('should compute tickets_open count correctly', async () => {
      // Mock: 10 OPEN tickets
      vi.mocked(prisma.ticket.count).mockImplementation(async (args: any) => {
        if (args?.where?.status === 'OPEN') return 10
        return 0
      })
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([])

      const result = await reports.service.computeKPIs()

      expect(result.tickets_open).toBe(10)
    })

    it('should compute tickets_pending count correctly', async () => {
      // Mock: 5 PENDING tickets
      vi.mocked(prisma.ticket.count).mockImplementation(async (args: any) => {
        if (args?.where?.status === 'PENDING') return 5
        return 0
      })
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([])

      const result = await reports.service.computeKPIs()

      expect(result.tickets_pending).toBe(5)
    })

    it('should compute tickets_solved_7d count correctly', async () => {
      // Mock: 15 SOLVED tickets within last 7 days
      vi.mocked(prisma.ticket.count).mockImplementation(async (args: any) => {
        if (args?.where?.status === 'SOLVED' && args?.where?.resolvedAt) return 15
        return 0
      })
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([])

      const result = await reports.service.computeKPIs()

      expect(result.tickets_solved_7d).toBe(15)
    })

    it('should compute avg_first_response_minutes correctly', async () => {
      // Mock: 2 tickets with comments
      // Ticket 1: created at 10:00, first comment at 10:30 (30 minutes)
      // Ticket 2: created at 11:00, first comment at 12:00 (60 minutes)
      // Average: (30 + 60) / 2 = 45 minutes
      vi.mocked(prisma.ticket.count).mockResolvedValue(0)
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([
        {
          id: 'ticket-1',
          createdAt: new Date('2025-10-08T10:00:00Z'),
          comments: [
            {
              id: 'comment-1',
              createdAt: new Date('2025-10-08T10:30:00Z'),
            },
          ],
        } as any,
        {
          id: 'ticket-2',
          createdAt: new Date('2025-10-08T11:00:00Z'),
          comments: [
            {
              id: 'comment-2',
              createdAt: new Date('2025-10-08T12:00:00Z'),
            },
          ],
        } as any,
      ])

      const result = await reports.service.computeKPIs()

      expect(result.avg_first_response_minutes).toBe(45)
    })

    it('should return 0 for avg_first_response_minutes when no tickets have comments', async () => {
      vi.mocked(prisma.ticket.count).mockResolvedValue(0)
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([])

      const result = await reports.service.computeKPIs()

      expect(result.avg_first_response_minutes).toBe(0)
    })
  })

  describe('repo.upsertWeek()', () => {
    it('should create new weekly snapshot', async () => {
      const input: reports.WeeklyKPIInput = {
        weekStartUTC: new Date('2025-10-06T00:00:00Z'),
        ticketsOpen: 10,
        ticketsPending: 5,
        ticketsSolved7d: 15,
        avgFirstResponseMinutes: 45,
      }

      vi.mocked(prisma.weeklyKPI.upsert).mockResolvedValue({
        id: 'kpi-1',
        weekStartUTC: input.weekStartUTC,
        ticketsOpen: input.ticketsOpen,
        ticketsPending: input.ticketsPending,
        ticketsSolved7d: input.ticketsSolved7d,
        avgFirstResponseMinutes: input.avgFirstResponseMinutes,
        createdAt: new Date(),
      })

      const result = await reports.repo.upsertWeek(input)

      expect(result.id).toBe('kpi-1')
      expect(result.ticketsOpen).toBe(10)
      expect(prisma.weeklyKPI.upsert).toHaveBeenCalledWith({
        where: { weekStartUTC: input.weekStartUTC },
        update: expect.any(Object),
        create: expect.any(Object),
      })
    })

    it('should update existing weekly snapshot', async () => {
      const input: reports.WeeklyKPIInput = {
        weekStartUTC: new Date('2025-10-06T00:00:00Z'),
        ticketsOpen: 12, // Updated value
        ticketsPending: 6,
        ticketsSolved7d: 20,
        avgFirstResponseMinutes: 50,
      }

      vi.mocked(prisma.weeklyKPI.upsert).mockResolvedValue({
        id: 'kpi-1',
        weekStartUTC: input.weekStartUTC,
        ticketsOpen: input.ticketsOpen,
        ticketsPending: input.ticketsPending,
        ticketsSolved7d: input.ticketsSolved7d,
        avgFirstResponseMinutes: input.avgFirstResponseMinutes,
        createdAt: new Date('2025-10-06T00:00:00Z'),
      })

      const result = await reports.repo.upsertWeek(input)

      expect(result.ticketsOpen).toBe(12)
    })
  })

  describe('repo.latest()', () => {
    it('should retrieve latest n weekly snapshots', async () => {
      vi.mocked(prisma.weeklyKPI.findMany).mockResolvedValue([
        {
          id: 'kpi-3',
          weekStartUTC: new Date('2025-10-06T00:00:00Z'),
          ticketsOpen: 10,
          ticketsPending: 5,
          ticketsSolved7d: 15,
          avgFirstResponseMinutes: 45,
          createdAt: new Date(),
        },
        {
          id: 'kpi-2',
          weekStartUTC: new Date('2025-09-29T00:00:00Z'),
          ticketsOpen: 8,
          ticketsPending: 4,
          ticketsSolved7d: 12,
          avgFirstResponseMinutes: 40,
          createdAt: new Date(),
        },
      ])

      const result = await reports.repo.latest(2)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('kpi-3')
      expect(result[1].id).toBe('kpi-2')
      expect(prisma.weeklyKPI.findMany).toHaveBeenCalledWith({
        orderBy: { weekStartUTC: 'desc' },
        take: 2,
      })
    })

    it('should default to n=1 if not specified', async () => {
      vi.mocked(prisma.weeklyKPI.findMany).mockResolvedValue([
        {
          id: 'kpi-1',
          weekStartUTC: new Date('2025-10-06T00:00:00Z'),
          ticketsOpen: 10,
          ticketsPending: 5,
          ticketsSolved7d: 15,
          avgFirstResponseMinutes: 45,
          createdAt: new Date(),
        },
      ])

      const result = await reports.repo.latest()

      expect(result).toHaveLength(1)
      expect(prisma.weeklyKPI.findMany).toHaveBeenCalledWith({
        orderBy: { weekStartUTC: 'desc' },
        take: 1,
      })
    })
  })

  describe('scheduler.runWeeklySnapshot()', () => {
    it('should compute KPIs and store weekly snapshot', async () => {
      // Mock service.computeKPIs
      vi.mocked(prisma.ticket.count).mockResolvedValue(10)
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([])

      // Mock repo.upsertWeek
      vi.mocked(prisma.weeklyKPI.upsert).mockResolvedValue({
        id: 'kpi-1',
        weekStartUTC: new Date('2025-10-06T00:00:00Z'),
        ticketsOpen: 10,
        ticketsPending: 0,
        ticketsSolved7d: 0,
        avgFirstResponseMinutes: 0,
        createdAt: new Date(),
      })

      const consoleSpy = vi.spyOn(console, 'log')

      await reports.scheduler.runWeeklySnapshot(new Date('2025-10-08T12:00:00Z'))

      expect(prisma.weeklyKPI.upsert).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[scheduler] Weekly snapshot saved for')
      )
    })

    it('should calculate correct weekStartUTC (Monday 00:00 UTC)', async () => {
      // Test with Wednesday 2025-10-08 12:00 UTC
      // Expected weekStart: Monday 2025-10-06 00:00 UTC
      vi.mocked(prisma.ticket.count).mockResolvedValue(0)
      vi.mocked(prisma.ticket.findMany).mockResolvedValue([])
      vi.mocked(prisma.weeklyKPI.upsert).mockResolvedValue({
        id: 'kpi-1',
        weekStartUTC: new Date('2025-10-06T00:00:00Z'),
        ticketsOpen: 0,
        ticketsPending: 0,
        ticketsSolved7d: 0,
        avgFirstResponseMinutes: 0,
        createdAt: new Date(),
      })

      await reports.scheduler.runWeeklySnapshot(new Date('2025-10-08T12:00:00Z'))

      expect(prisma.weeklyKPI.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { weekStartUTC: new Date('2025-10-06T00:00:00.000Z') },
        })
      )
    })
  })

  describe('Module Exports', () => {
    it('should export service module', () => {
      expect(reports.service).toBeDefined()
      expect(reports.service.computeKPIs).toBeInstanceOf(Function)
    })

    it('should export repo module', () => {
      expect(reports.repo).toBeDefined()
      expect(reports.repo.upsertWeek).toBeInstanceOf(Function)
      expect(reports.repo.latest).toBeInstanceOf(Function)
    })

    it('should export scheduler module', () => {
      expect(reports.scheduler).toBeDefined()
      expect(reports.scheduler.runWeeklySnapshot).toBeInstanceOf(Function)
    })
  })
})
