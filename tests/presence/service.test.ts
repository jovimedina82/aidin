/**
 * Service tests for lib/presence/service.ts
 *
 * Tests:
 * - planDay transactional guarantees
 * - getDay query logic
 * - deleteSegment authorization
 * - getWeekView merging
 * - getCurrentPresences deduplication
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { PrismaClient } from '../../lib/generated/prisma'
import {
  planDay,
  getDay,
  deleteSegment,
  getWeekView,
  getCurrentPresences,
} from '../../lib/presence/service'
import type { PlanDay } from '../../lib/presence/validation'

const prisma = new PrismaClient()

let testUserId: string
let testStatusAvailableId: string
let testStatusRemoteId: string
let testOfficeId: string

beforeAll(async () => {
  // Create test user
  const user = await prisma.user.create({
    data: {
      email: `presence-test-${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      password: 'test123',
      userType: 'Staff',
    },
  })
  testUserId = user.id

  // Ensure test statuses exist
  const availableStatus = await prisma.presenceStatusType.upsert({
    where: { code: 'AVAILABLE' },
    update: {},
    create: {
      code: 'AVAILABLE',
      label: 'Available',
      category: 'presence',
      requiresOffice: true,
      color: '#22c55e',
      isActive: true,
    },
  })
  testStatusAvailableId = availableStatus.id

  const remoteStatus = await prisma.presenceStatusType.upsert({
    where: { code: 'REMOTE' },
    update: {},
    create: {
      code: 'REMOTE',
      label: 'Remote',
      category: 'presence',
      requiresOffice: false,
      color: '#3b82f6',
      isActive: true,
    },
  })
  testStatusRemoteId = remoteStatus.id

  const office = await prisma.presenceOfficeLocation.upsert({
    where: { code: 'NEWPORT_BEACH' },
    update: {},
    create: {
      code: 'NEWPORT_BEACH',
      name: 'Newport Beach',
      isActive: true,
    },
  })
  testOfficeId = office.id
})

afterAll(async () => {
  // Cleanup test user and their presence records
  if (testUserId) {
    await prisma.staffPresence.deleteMany({ where: { userId: testUserId } })
    await prisma.user.delete({ where: { id: testUserId } })
  }
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Clear presence records before each test
  await prisma.staffPresence.deleteMany({ where: { userId: testUserId } })
})

describe('Service - planDay', () => {
  it('should create segments for a single day', async () => {
    const plan: PlanDay = {
      date: '2025-01-15',
      segments: [
        { statusCode: 'REMOTE', from: '09:00', to: '12:00' },
        { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '13:00', to: '17:00' },
      ],
    }

    const result = await planDay(testUserId, plan)

    expect(result).toHaveLength(2)
    expect(result[0].status.code).toBe('REMOTE')
    expect(result[0].startTime).toBe('09:00')
    expect(result[1].status.code).toBe('AVAILABLE')
    expect(result[1].officeLocation?.code).toBe('NEWPORT_BEACH')

    // Verify in database
    const dbSegments = await prisma.staffPresence.findMany({
      where: { userId: testUserId },
    })
    expect(dbSegments).toHaveLength(2)
  })

  it('should replace existing segments for the same day', async () => {
    // Create initial segments
    const initial: PlanDay = {
      date: '2025-01-15',
      segments: [{ statusCode: 'REMOTE', from: '09:00', to: '17:00' }],
    }
    await planDay(testUserId, initial)

    // Verify initial state
    let dbSegments = await prisma.staffPresence.findMany({
      where: { userId: testUserId },
    })
    expect(dbSegments).toHaveLength(1)

    // Update with new segments
    const updated: PlanDay = {
      date: '2025-01-15',
      segments: [
        { statusCode: 'REMOTE', from: '09:00', to: '12:00' },
        { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '13:00', to: '17:00' },
      ],
    }
    const result = await planDay(testUserId, updated)

    expect(result).toHaveLength(2)

    // Verify old segments were deleted and new ones created
    dbSegments = await prisma.staffPresence.findMany({
      where: { userId: testUserId },
    })
    expect(dbSegments).toHaveLength(2)
  })

  it('should create segments across multiple days with repeatUntil', async () => {
    const plan: PlanDay = {
      date: '2025-01-15',
      repeatUntil: '2025-01-17', // 3 days total
      segments: [{ statusCode: 'REMOTE', from: '09:00', to: '17:00' }],
    }

    const result = await planDay(testUserId, plan)

    // Result only contains first day
    expect(result).toHaveLength(1)

    // But database should have 3 days worth
    const dbSegments = await prisma.staffPresence.findMany({
      where: { userId: testUserId },
    })
    expect(dbSegments).toHaveLength(3)
  })

  it('should rollback transaction on error', async () => {
    const plan: PlanDay = {
      date: '2025-01-15',
      segments: [
        { statusCode: 'INVALID_STATUS', from: '09:00', to: '12:00' }, // Invalid status
      ],
    }

    await expect(planDay(testUserId, plan)).rejects.toThrow()

    // Verify nothing was created
    const dbSegments = await prisma.staffPresence.findMany({
      where: { userId: testUserId },
    })
    expect(dbSegments).toHaveLength(0)
  })
})

describe('Service - getDay', () => {
  beforeEach(async () => {
    // Create test segments
    await prisma.staffPresence.createMany({
      data: [
        {
          userId: testUserId,
          statusId: testStatusRemoteId,
          officeLocationId: null,
          notes: null,
          startAt: new Date('2025-01-15T17:00:00Z'), // 09:00 PST
          endAt: new Date('2025-01-15T20:00:00Z'), // 12:00 PST
        },
        {
          userId: testUserId,
          statusId: testStatusAvailableId,
          officeLocationId: testOfficeId,
          notes: 'Meeting at office',
          startAt: new Date('2025-01-15T21:00:00Z'), // 13:00 PST
          endAt: new Date('2025-01-16T01:00:00Z'), // 17:00 PST
        },
      ],
    })
  })

  it('should return segments for a specific day', async () => {
    const result = await getDay(testUserId, '2025-01-15')

    expect(result).toHaveLength(2)
    expect(result[0].status.code).toBe('REMOTE')
    expect(result[1].status.code).toBe('AVAILABLE')
    expect(result[1].officeLocation?.name).toBe('Newport Beach')
    expect(result[1].notes).toBe('Meeting at office')
  })

  it('should return empty array for day with no segments', async () => {
    const result = await getDay(testUserId, '2025-01-20')

    expect(result).toHaveLength(0)
  })

  it('should convert UTC to local time correctly', async () => {
    const result = await getDay(testUserId, '2025-01-15')

    expect(result[0].startTime).toBe('09:00')
    expect(result[0].endTime).toBe('12:00')
    expect(result[1].startTime).toBe('13:00')
    expect(result[1].endTime).toBe('17:00')
  })
})

describe('Service - deleteSegment', () => {
  let segmentId: string

  beforeEach(async () => {
    const segment = await prisma.staffPresence.create({
      data: {
        userId: testUserId,
        statusId: testStatusRemoteId,
        officeLocationId: null,
        notes: null,
        startAt: new Date('2025-01-15T17:00:00Z'),
        endAt: new Date('2025-01-16T01:00:00Z'),
      },
    })
    segmentId = segment.id
  })

  it('should delete segment when user is owner', async () => {
    await deleteSegment(testUserId, segmentId)

    const segment = await prisma.staffPresence.findUnique({
      where: { id: segmentId },
    })
    expect(segment).toBeNull()
  })

  it('should throw error when segment not found', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'

    await expect(deleteSegment(testUserId, fakeId)).rejects.toThrow('Segment not found')
  })

  it('should throw error when user is not owner', async () => {
    const otherUserId = '11111111-1111-1111-1111-111111111111'

    await expect(deleteSegment(otherUserId, segmentId)).rejects.toThrow('Unauthorized')
  })
})

describe('Service - getWeekView', () => {
  beforeEach(async () => {
    // Create segments spanning a week
    const segments = [
      {
        userId: testUserId,
        statusId: testStatusRemoteId,
        officeLocationId: null,
        notes: null,
        startAt: new Date('2025-01-13T17:00:00Z'), // Monday 09:00
        endAt: new Date('2025-01-14T01:00:00Z'), // Monday 17:00
      },
      {
        userId: testUserId,
        statusId: testStatusAvailableId,
        officeLocationId: testOfficeId,
        notes: null,
        startAt: new Date('2025-01-14T17:00:00Z'), // Tuesday 09:00
        endAt: new Date('2025-01-15T01:00:00Z'), // Tuesday 17:00
      },
      {
        userId: testUserId,
        statusId: testStatusRemoteId,
        officeLocationId: null,
        notes: null,
        startAt: new Date('2025-01-15T17:00:00Z'), // Wednesday 09:00
        endAt: new Date('2025-01-16T01:00:00Z'), // Wednesday 17:00
      },
    ]

    await prisma.staffPresence.createMany({ data: segments })
  })

  it('should return 7 days starting from given date', async () => {
    const result = await getWeekView(testUserId, '2025-01-13')

    expect(result).toHaveLength(7)
    expect(result[0].date).toBe('2025-01-13')
    expect(result[6].date).toBe('2025-01-19')
  })

  it('should group segments by date correctly', async () => {
    const result = await getWeekView(testUserId, '2025-01-13')

    // Monday (Jan 13) should have 1 segment
    expect(result[0].schedules).toHaveLength(1)
    expect(result[0].schedules[0].status).toContain('Remote')

    // Tuesday (Jan 14) should have 1 segment
    expect(result[1].schedules).toHaveLength(1)
    expect(result[1].schedules[0].status).toContain('Available')
    expect(result[1].schedules[0].location).toBe('Newport Beach')

    // Wednesday (Jan 15) should have 1 segment
    expect(result[2].schedules).toHaveLength(1)

    // Remaining days should have no segments
    expect(result[3].schedules).toHaveLength(0)
    expect(result[4].schedules).toHaveLength(0)
    expect(result[5].schedules).toHaveLength(0)
    expect(result[6].schedules).toHaveLength(0)
  })

  it('should include day metadata (dayOfWeek, month, dayNumber)', async () => {
    const result = await getWeekView(testUserId, '2025-01-13')

    expect(result[0].dayOfWeek).toBe('Monday')
    expect(result[0].month).toBe('Jan')
    expect(result[0].dayNumber).toBe(13)
  })
})

describe('Service - getCurrentPresences', () => {
  let otherUserId: string

  beforeAll(async () => {
    // Create another test user
    const user = await prisma.user.create({
      data: {
        email: `presence-other-${Date.now()}@test.com`,
        firstName: 'Other',
        lastName: 'User',
        password: 'test123',
        userType: 'Staff',
      },
    })
    otherUserId = user.id
  })

  afterAll(async () => {
    // Cleanup
    if (otherUserId) {
      await prisma.staffPresence.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } })
    }
  })

  it('should return current presences for all users', async () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

    await prisma.staffPresence.createMany({
      data: [
        {
          userId: testUserId,
          statusId: testStatusRemoteId,
          officeLocationId: null,
          notes: null,
          startAt: oneHourAgo,
          endAt: oneHourLater,
        },
        {
          userId: otherUserId,
          statusId: testStatusAvailableId,
          officeLocationId: testOfficeId,
          notes: 'In office',
          startAt: oneHourAgo,
          endAt: oneHourLater,
        },
      ],
    })

    const result = await getCurrentPresences()

    expect(result).toHaveLength(2)
    expect(result.find(p => p.userId === testUserId)?.statusCode).toBe('REMOTE')
    expect(result.find(p => p.userId === otherUserId)?.statusCode).toBe('AVAILABLE')
  })

  it('should filter by specific user IDs', async () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

    await prisma.staffPresence.createMany({
      data: [
        {
          userId: testUserId,
          statusId: testStatusRemoteId,
          officeLocationId: null,
          notes: null,
          startAt: oneHourAgo,
          endAt: oneHourLater,
        },
        {
          userId: otherUserId,
          statusId: testStatusAvailableId,
          officeLocationId: testOfficeId,
          notes: null,
          startAt: oneHourAgo,
          endAt: oneHourLater,
        },
      ],
    })

    const result = await getCurrentPresences([testUserId])

    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe(testUserId)
  })

  it('should deduplicate multiple presences per user (take most recent)', async () => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

    // Create two overlapping presences for the same user
    await prisma.staffPresence.createMany({
      data: [
        {
          userId: testUserId,
          statusId: testStatusRemoteId,
          officeLocationId: null,
          notes: 'Older',
          startAt: twoHoursAgo,
          endAt: oneHourLater,
        },
        {
          userId: testUserId,
          statusId: testStatusAvailableId,
          officeLocationId: testOfficeId,
          notes: 'Newer',
          startAt: oneHourAgo,
          endAt: oneHourLater,
        },
      ],
    })

    const result = await getCurrentPresences([testUserId])

    expect(result).toHaveLength(1)
    expect(result[0].notes).toBe('Newer') // Should take the most recent
  })
})
