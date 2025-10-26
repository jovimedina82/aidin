/**
 * Presence Module Registry
 *
 * 60-second TTL in-memory cache of active statuses and offices.
 * Prevents constant DB queries while ensuring fresh data.
 */

import { prisma } from '@/lib/prisma'

interface CachedStatus {
  id: string
  code: string
  label: string
  category: string
  requiresOffice: boolean
  color: string | null
  icon: string | null
}

interface CachedOffice {
  id: string
  code: string
  name: string
}

interface RegistryCache {
  statuses: CachedStatus[]
  offices: CachedOffice[]
  timestamp: number
}

const CACHE_TTL = 60 * 1000 // 60 seconds
let cache: RegistryCache | null = null

/**
 * Bust the cache (call after admin updates)
 */
export function bustRegistryCache() {
  cache = null
}

/**
 * Get active statuses (cached)
 */
export async function getActiveStatuses(): Promise<CachedStatus[]> {
  await refreshCache()
  return cache!.statuses
}

/**
 * Get active offices (cached)
 */
export async function getActiveOffices(): Promise<CachedOffice[]> {
  await refreshCache()
  return cache!.offices
}

/**
 * Resolve a status by code (active only)
 */
export async function resolveStatus(code: string): Promise<CachedStatus | null> {
  const statuses = await getActiveStatuses()
  return statuses.find(s => s.code === code) || null
}

/**
 * Resolve an office by code (active only)
 */
export async function resolveOffice(code: string): Promise<CachedOffice | null> {
  const offices = await getActiveOffices()
  return offices.find(o => o.code === code) || null
}

/**
 * Refresh cache if expired
 */
async function refreshCache() {
  const now = Date.now()

  if (cache && (now - cache.timestamp) < CACHE_TTL) {
    return // Cache still valid
  }

  // Fetch fresh data
  const [statuses, offices] = await Promise.all([
    prisma.presenceStatusType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        label: true,
        category: true,
        requiresOffice: true,
        color: true,
        icon: true,
      },
      orderBy: { label: 'asc' },
    }),
    prisma.presenceOfficeLocation.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    }),
  ])

  cache = {
    statuses,
    offices,
    timestamp: now,
  }
}

/**
 * Get options for UI (public API shape)
 */
export async function getPresenceOptions() {
  const [statuses, offices] = await Promise.all([
    getActiveStatuses(),
    getActiveOffices(),
  ])

  return {
    statuses: statuses.map(s => ({
      code: s.code,
      label: s.label,
      color: s.color,
      icon: s.icon,
      requiresOffice: s.requiresOffice,
    })),
    offices: offices.map(o => ({
      code: o.code,
      name: o.name,
    })),
  }
}
