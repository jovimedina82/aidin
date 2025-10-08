/**
 * Phase 9: Analytics & Weekly Reporting
 * Repository layer for WeeklyKPI Prisma operations
 */

import { WeeklyKPI, WeeklyKPIInput } from './domain'
import { prisma } from '@/lib/prisma'

/**
 * Upsert a weekly KPI snapshot
 * If a snapshot exists for the given weekStartUTC, update it
 * Otherwise, create a new one
 */
export async function upsertWeek(data: WeeklyKPIInput): Promise<WeeklyKPI> {
  const record = await prisma.weeklyKPI.upsert({
    where: { weekStartUTC: data.weekStartUTC },
    update: {
      ticketsOpen: data.ticketsOpen,
      ticketsPending: data.ticketsPending,
      ticketsSolved7d: data.ticketsSolved7d,
      avgFirstResponseMinutes: data.avgFirstResponseMinutes,
    },
    create: {
      weekStartUTC: data.weekStartUTC,
      ticketsOpen: data.ticketsOpen,
      ticketsPending: data.ticketsPending,
      ticketsSolved7d: data.ticketsSolved7d,
      avgFirstResponseMinutes: data.avgFirstResponseMinutes,
    },
  })

  return {
    id: record.id,
    weekStartUTC: record.weekStartUTC,
    ticketsOpen: record.ticketsOpen,
    ticketsPending: record.ticketsPending,
    ticketsSolved7d: record.ticketsSolved7d,
    avgFirstResponseMinutes: record.avgFirstResponseMinutes,
    createdAt: record.createdAt,
  }
}

/**
 * Retrieve the latest n weekly KPI snapshots
 * Ordered by weekStartUTC descending
 */
export async function latest(n: number = 1): Promise<WeeklyKPI[]> {
  const records = await prisma.weeklyKPI.findMany({
    orderBy: { weekStartUTC: 'desc' },
    take: n,
  })

  return records.map((record) => ({
    id: record.id,
    weekStartUTC: record.weekStartUTC,
    ticketsOpen: record.ticketsOpen,
    ticketsPending: record.ticketsPending,
    ticketsSolved7d: record.ticketsSolved7d,
    avgFirstResponseMinutes: record.avgFirstResponseMinutes,
    createdAt: record.createdAt,
  }))
}
