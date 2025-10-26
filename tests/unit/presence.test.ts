/**
 * Unit Tests for Presence Module
 *
 * Run with: npx vitest run tests/unit/presence.test.ts
 *
 * Note: Vitest must be installed first:
 * npm install --save-dev vitest @vitest/ui
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { validateSegments, calculateTotalMinutes, calculateRemainingMinutes, formatDuration } from '@/lib/presence/validation'
import { localToUTC, utcToLocalTime, crossesMidnight } from '@/lib/presence/timezone'
import { resolveStatus, resolveOffice, bustRegistryCache } from '@/lib/presence/registry'

describe('Presence Validation', () => {
  describe('Overlap Detection', () => {
    it('should detect overlapping segments', async () => {
      const segments = [
        { statusCode: 'AVAILABLE', from: '09:00', to: '12:00' },
        { statusCode: 'WORKING_REMOTE', from: '11:00', to: '14:00' }, // Overlaps with first
      ]

      await expect(validateSegments(segments as any)).rejects.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'segments[1]',
            message: expect.stringContaining('Overlaps'),
          }),
        ])
      )
    })

    it('should allow non-overlapping segments', async () => {
      const segments = [
        { statusCode: 'AVAILABLE', from: '09:00', to: '12:00' },
        { statusCode: 'WORKING_REMOTE', from: '13:00', to: '17:00' },
      ]

      await expect(validateSegments(segments as any)).resolves.toBeUndefined()
    })

    it('should allow adjacent segments (no gap)', async () => {
      const segments = [
        { statusCode: 'AVAILABLE', from: '09:00', to: '12:00' },
        { statusCode: 'WORKING_REMOTE', from: '12:00', to: '17:00' },
      ]

      await expect(validateSegments(segments as any)).resolves.toBeUndefined()
    })
  })

  describe('Duration Cap Enforcement', () => {
    it('should reject segments exceeding 8h daily cap', async () => {
      const segments = [
        { statusCode: 'AVAILABLE', from: '09:00', to: '18:00' }, // 9 hours
      ]

      await expect(validateSegments(segments as any)).rejects.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'segments',
            message: expect.stringContaining('exceeds daily cap'),
          }),
        ])
      )
    })

    it('should allow segments exactly at 8h cap', async () => {
      const segments = [
        { statusCode: 'AVAILABLE', from: '09:00', to: '17:00' }, // 8 hours
      ]

      await expect(validateSegments(segments as any)).resolves.toBeUndefined()
    })

    it('should sum multiple segments correctly', async () => {
      const segments = [
        { statusCode: 'AVAILABLE', from: '09:00', to: '12:00' }, // 3h
        { statusCode: 'WORKING_REMOTE', from: '13:00', to: '18:00' }, // 5h
      ]

      await expect(validateSegments(segments as any)).resolves.toBeUndefined() // Total 8h
    })
  })

  describe('requiresOffice Enforcement', () => {
    it('should require office when status requiresOffice=true', async () => {
      const segments = [
        { statusCode: 'AVAILABLE', from: '09:00', to: '17:00' }, // AVAILABLE requires office
      ]

      await expect(validateSegments(segments as any)).rejects.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'segments[0].officeCode',
            message: expect.stringContaining('requires an office location'),
          }),
        ])
      )
    })

    it('should accept office when status requiresOffice=true', async () => {
      const segments = [
        { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '09:00', to: '17:00' },
      ]

      await expect(validateSegments(segments as any)).resolves.toBeUndefined()
    })

    it('should not require office when status requiresOffice=false', async () => {
      const segments = [
        { statusCode: 'WORKING_REMOTE', from: '09:00', to: '17:00' },
      ]

      await expect(validateSegments(segments as any)).resolves.toBeUndefined()
    })
  })

  describe('Midnight Crossing Prevention', () => {
    it('should reject segments where to <= from', async () => {
      const segments = [
        { statusCode: 'WORKING_REMOTE', from: '17:00', to: '09:00' }, // Crosses midnight
      ]

      await expect(validateSegments(segments as any)).rejects.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'segments[0].to',
            message: expect.stringContaining('cannot cross midnight'),
          }),
        ])
      )
    })

    it('should accept valid time ranges', async () => {
      const segments = [
        { statusCode: 'WORKING_REMOTE', from: '09:00', to: '17:00' },
      ]

      await expect(validateSegments(segments as any)).resolves.toBeUndefined()
    })
  })
})

describe('Registry Cache', () => {
  beforeAll(() => {
    bustRegistryCache()
  })

  afterAll(() => {
    bustRegistryCache()
  })

  describe('Active Lookup Only', () => {
    it('should return only active statuses', async () => {
      const status = await resolveStatus('AVAILABLE')
      expect(status).toBeDefined()
      expect(status?.code).toBe('AVAILABLE')
    })

    it('should return null for inactive/non-existent statuses', async () => {
      const status = await resolveStatus('NONEXISTENT_STATUS')
      expect(status).toBeNull()
    })

    it('should return only active offices', async () => {
      const office = await resolveOffice('NEWPORT_BEACH')
      expect(office).toBeDefined()
      expect(office?.code).toBe('NEWPORT_BEACH')
    })

    it('should return null for inactive/non-existent offices', async () => {
      const office = await resolveOffice('NONEXISTENT_OFFICE')
      expect(office).toBeNull()
    })
  })

  describe('Cache Behavior', () => {
    it('should cache statuses for 60 seconds', async () => {
      bustRegistryCache()
      const status1 = await resolveStatus('AVAILABLE')
      const status2 = await resolveStatus('AVAILABLE')

      expect(status1).toEqual(status2)
    })

    it('should refresh cache when busted', async () => {
      await resolveStatus('AVAILABLE') // Populate cache
      bustRegistryCache()
      const status = await resolveStatus('AVAILABLE') // Should re-fetch

      expect(status).toBeDefined()
    })
  })
})

describe('Timezone Utilities', () => {
  const TZ = 'America/Los_Angeles'

  describe('Local to UTC Conversion', () => {
    it('should convert local date+time to UTC', () => {
      const utc = localToUTC('2025-01-15', '09:00', TZ)
      expect(utc).toBeInstanceOf(Date)
      // LA is UTC-8 in winter, so 09:00 LA = 17:00 UTC
      expect(utc.getUTCHours()).toBe(17)
    })

    it('should handle midnight correctly', () => {
      const utc = localToUTC('2025-01-15', '00:00', TZ)
      expect(utc).toBeInstanceOf(Date)
      expect(utc.getUTCHours()).toBe(8)
    })
  })

  describe('UTC to Local Time Conversion', () => {
    it('should convert UTC to local time string', () => {
      const utc = new Date('2025-01-15T17:00:00Z') // 17:00 UTC
      const local = utcToLocalTime(utc, TZ)
      expect(local).toBe('09:00') // Should be 09:00 LA time
    })

    it('should handle different timezones', () => {
      const utc = new Date('2025-01-15T12:00:00Z')
      const la = utcToLocalTime(utc, 'America/Los_Angeles')
      const ny = utcToLocalTime(utc, 'America/New_York')

      expect(la).toBe('04:00') // UTC-8
      expect(ny).toBe('07:00') // UTC-5
    })
  })

  describe('Midnight Crossing Check', () => {
    it('should detect midnight crossing', () => {
      expect(crossesMidnight('17:00', '09:00')).toBe(true)
      expect(crossesMidnight('23:59', '00:00')).toBe(true)
    })

    it('should allow valid time ranges', () => {
      expect(crossesMidnight('09:00', '17:00')).toBe(false)
      expect(crossesMidnight('00:00', '23:59')).toBe(false)
    })

    it('should detect equal times as invalid', () => {
      expect(crossesMidnight('12:00', '12:00')).toBe(true)
    })
  })
})

describe('Duration Helpers', () => {
  describe('calculateTotalMinutes', () => {
    it('should calculate total minutes for single segment', () => {
      const segments = [{ from: '09:00', to: '17:00', statusCode: 'AVAILABLE' }]
      expect(calculateTotalMinutes(segments as any)).toBe(480) // 8 hours
    })

    it('should calculate total minutes for multiple segments', () => {
      const segments = [
        { from: '09:00', to: '12:00', statusCode: 'AVAILABLE' }, // 3h
        { from: '13:00', to: '17:00', statusCode: 'WORKING_REMOTE' }, // 4h
      ]
      expect(calculateTotalMinutes(segments as any)).toBe(420) // 7 hours
    })
  })

  describe('calculateRemainingMinutes', () => {
    it('should calculate remaining minutes before cap', () => {
      const segments = [{ from: '09:00', to: '14:00', statusCode: 'AVAILABLE' }] // 5h
      expect(calculateRemainingMinutes(segments as any)).toBe(180) // 3h remaining
    })

    it('should return 0 when at or over cap', () => {
      const segments = [{ from: '09:00', to: '18:00', statusCode: 'AVAILABLE' }] // 9h
      expect(calculateRemainingMinutes(segments as any)).toBe(0)
    })
  })

  describe('formatDuration', () => {
    it('should format hours only', () => {
      expect(formatDuration(120)).toBe('2h')
      expect(formatDuration(480)).toBe('8h')
    })

    it('should format minutes only', () => {
      expect(formatDuration(45)).toBe('45m')
    })

    it('should format hours and minutes', () => {
      expect(formatDuration(150)).toBe('2h 30m')
      expect(formatDuration(495)).toBe('8h 15m')
    })
  })
})
