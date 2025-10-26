/**
 * Unit tests for lib/presence/validation.ts
 *
 * Tests business rules:
 * - 8h daily cap enforcement
 * - Overlap detection
 * - Midnight crossing prevention
 * - Office requirement validation
 * - Duplicate prevention
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient } from '../../lib/generated/prisma'
import {
  validateSegments,
  validatePlanDay,
  calculateTotalMinutes,
  calculateRemainingMinutes,
  formatDuration,
  MAX_DAY_MINUTES,
  MAX_RANGE_DAYS,
  type Segment,
  type PlanDay,
} from '../../lib/presence/validation'

const prisma = new PrismaClient()

beforeAll(async () => {
  // Ensure test statuses and offices exist
  await prisma.presenceStatusType.upsert({
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

  await prisma.presenceStatusType.upsert({
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

  await prisma.presenceOfficeLocation.upsert({
    where: { code: 'NEWPORT_BEACH' },
    update: {},
    create: {
      code: 'NEWPORT_BEACH',
      name: 'Newport Beach',
      isActive: true,
    },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('Validation - Time Calculations', () => {
  it('should calculate total minutes correctly', () => {
    const segments: Segment[] = [
      { statusCode: 'AVAILABLE', from: '09:00', to: '12:00' }, // 3h = 180m
      { statusCode: 'AVAILABLE', from: '13:00', to: '17:00' }, // 4h = 240m
    ]

    expect(calculateTotalMinutes(segments)).toBe(420) // 7h
  })

  it('should calculate remaining minutes correctly', () => {
    const segments: Segment[] = [
      { statusCode: 'AVAILABLE', from: '09:00', to: '12:00' }, // 3h = 180m
    ]

    expect(calculateRemainingMinutes(segments)).toBe(300) // 5h remaining (480 - 180)
  })

  it('should format duration as hours and minutes', () => {
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(30)).toBe('30m')
    expect(formatDuration(90)).toBe('1h 30m')
    expect(formatDuration(480)).toBe('8h')
  })
})

describe('Validation - Daily Cap (8h)', () => {
  it('should reject segments exceeding 8h cap', async () => {
    const segments: Segment[] = [
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '09:00', to: '18:00' }, // 9h
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'segments',
          message: expect.stringContaining('exceeds daily cap'),
        }),
      ])
    )
  })

  it('should accept segments at exactly 8h', async () => {
    const segments: Segment[] = [
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '09:00', to: '17:00' }, // 8h
    ]

    await expect(validateSegments(segments)).resolves.toBeUndefined()
  })

  it('should accept multiple segments totaling less than 8h', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '11:00' }, // 2h
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '11:00', to: '17:00' }, // 6h
    ]

    await expect(validateSegments(segments)).resolves.toBeUndefined()
  })

  it('should reject multiple segments totaling over 8h', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '13:00' }, // 4h
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '13:00', to: '18:00' }, // 5h = 9h total
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'segments',
          message: expect.stringContaining('exceeds daily cap'),
        }),
      ])
    )
  })
})

describe('Validation - Overlaps', () => {
  it('should reject overlapping segments (partial overlap)', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '12:00' },
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '11:00', to: '15:00' }, // Overlaps 11:00-12:00
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Overlaps'),
        }),
      ])
    )
  })

  it('should reject overlapping segments (complete overlap)', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '17:00' },
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '11:00', to: '15:00' }, // Completely inside
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Overlaps'),
        }),
      ])
    )
  })

  it('should accept adjacent non-overlapping segments', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '12:00' },
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '12:00', to: '17:00' }, // Starts exactly when first ends
    ]

    await expect(validateSegments(segments)).resolves.toBeUndefined()
  })

  it('should accept non-overlapping segments with gap', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '11:00' },
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '13:00', to: '17:00' }, // 2h gap
    ]

    await expect(validateSegments(segments)).resolves.toBeUndefined()
  })
})

describe('Validation - Midnight Crossing', () => {
  it('should reject time ranges crossing midnight', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '22:00', to: '02:00' }, // Crosses midnight
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('cannot cross midnight'),
        }),
      ])
    )
  })

  it('should reject same start and end time', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '09:00' },
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('cannot cross midnight'),
        }),
      ])
    )
  })

  it('should accept valid time range within same day', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '17:00' },
    ]

    await expect(validateSegments(segments)).resolves.toBeUndefined()
  })
})

describe('Validation - Office Requirement', () => {
  it('should reject AVAILABLE status without office', async () => {
    const segments: Segment[] = [
      { statusCode: 'AVAILABLE', from: '09:00', to: '17:00' }, // Missing officeCode
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('requires an office location'),
        }),
      ])
    )
  })

  it('should accept AVAILABLE status with office', async () => {
    const segments: Segment[] = [
      { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '09:00', to: '17:00' },
    ]

    await expect(validateSegments(segments)).resolves.toBeUndefined()
  })

  it('should accept REMOTE status without office', async () => {
    const segments: Segment[] = [
      { statusCode: 'REMOTE', from: '09:00', to: '17:00' },
    ]

    await expect(validateSegments(segments)).resolves.toBeUndefined()
  })

  it('should reject invalid status code', async () => {
    const segments: Segment[] = [
      { statusCode: 'INVALID_STATUS', from: '09:00', to: '17:00' },
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('not found or inactive'),
        }),
      ])
    )
  })

  it('should reject invalid office code', async () => {
    const segments: Segment[] = [
      { statusCode: 'AVAILABLE', officeCode: 'INVALID_OFFICE', from: '09:00', to: '17:00' },
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('not found or inactive'),
        }),
      ])
    )
  })
})

describe('Validation - Plan Day', () => {
  it('should validate repeatUntil range limit', async () => {
    const plan: PlanDay = {
      date: '2025-01-01',
      repeatUntil: '2025-02-15', // 45 days (exceeds MAX_RANGE_DAYS of 30)
      segments: [{ statusCode: 'REMOTE', from: '09:00', to: '17:00' }],
    }

    await expect(validatePlanDay(plan)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'repeatUntil',
          message: expect.stringContaining(`cannot exceed ${MAX_RANGE_DAYS} days`),
        }),
      ])
    )
  })

  it('should validate repeatUntil is after start date', async () => {
    const plan: PlanDay = {
      date: '2025-01-15',
      repeatUntil: '2025-01-10', // Before start date
      segments: [{ statusCode: 'REMOTE', from: '09:00', to: '17:00' }],
    }

    await expect(validatePlanDay(plan)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'repeatUntil',
          message: expect.stringContaining('must be after start date'),
        }),
      ])
    )
  })

  it('should accept valid repeatUntil range', async () => {
    const plan: PlanDay = {
      date: '2025-01-01',
      repeatUntil: '2025-01-07', // 7 days (valid)
      segments: [{ statusCode: 'REMOTE', from: '09:00', to: '17:00' }],
    }

    await expect(validatePlanDay(plan)).resolves.toBeUndefined()
  })

  it('should validate single day plan', async () => {
    const plan: PlanDay = {
      date: '2025-01-01',
      segments: [{ statusCode: 'REMOTE', from: '09:00', to: '17:00' }],
    }

    await expect(validatePlanDay(plan)).resolves.toBeUndefined()
  })
})

describe('Validation - Multiple Errors', () => {
  it('should return multiple validation errors', async () => {
    const segments: Segment[] = [
      { statusCode: 'AVAILABLE', from: '09:00', to: '18:00' }, // Missing office + exceeds cap
      { statusCode: 'INVALID', from: '10:00', to: '11:00' }, // Invalid status
    ]

    await expect(validateSegments(segments)).rejects.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('requires an office') }),
        expect.objectContaining({ message: expect.stringContaining('not found or inactive') }),
        expect.objectContaining({ message: expect.stringContaining('exceeds daily cap') }),
        expect.objectContaining({ message: expect.stringContaining('Overlaps') }),
      ])
    )
  })
})
