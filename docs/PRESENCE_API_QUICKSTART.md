# Presence System - Quick Start Guide

## For Frontend Developers

### 1. Get Options (Statuses & Offices)

```typescript
const response = await fetch('/api/presence/options')
const { statuses, offices } = await response.json()

// statuses: [{ code, label, color, icon, requiresOffice }, ...]
// offices: [{ code, name }, ...]
```

### 2. View a Day's Schedule

```typescript
const userId = 'user-uuid' // Optional, defaults to current user
const date = '2025-01-20' // YYYY-MM-DD

const response = await fetch(`/api/presence/day?userId=${userId}&date=${date}`)
const { segments } = await response.json()

// segments: [{ id, statusCode, from, to, officeCode?, notes? }, ...]
```

### 3. Plan a Day (Create/Update Schedule)

```typescript
const plan = {
  date: '2025-01-20',
  segments: [
    {
      statusCode: 'REMOTE',
      from: '09:00',
      to: '12:00',
      notes: 'Focus time' // Optional
    },
    {
      statusCode: 'AVAILABLE',
      officeCode: 'NEWPORT_BEACH', // Required for AVAILABLE
      from: '13:00',
      to: '17:00'
    }
  ]
}

const response = await fetch('/api/presence/plan-day', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(plan)
})

if (!response.ok) {
  const { error, details } = await response.json()
  // details: [{ field, message }, ...]
}
```

### 4. Plan Multiple Days (Repeat)

```typescript
const plan = {
  date: '2025-01-20',
  repeatUntil: '2025-01-24', // Will create for Mon-Fri
  segments: [
    { statusCode: 'REMOTE', from: '09:00', to: '17:00' }
  ]
}

await fetch('/api/presence/plan-day', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(plan)
})
```

### 5. Delete a Segment

```typescript
const segmentId = 'segment-uuid'

await fetch(`/api/presence/segment/${segmentId}`, {
  method: 'DELETE'
})
```

## Validation Rules (Client-Side)

Before submitting, validate:

```typescript
import { calculateTotalMinutes, MAX_DAY_MINUTES } from '@/lib/presence/validation'

const segments = [
  { from: '09:00', to: '12:00' },
  { from: '13:00', to: '19:00' }
]

const totalMinutes = calculateTotalMinutes(segments)
if (totalMinutes > MAX_DAY_MINUTES) {
  alert(`Total ${totalMinutes / 60}h exceeds 8h daily cap`)
}
```

## Common Patterns

### Show Live Duration Counter

```tsx
import { calculateTotalMinutes, formatDuration } from '@/lib/presence/validation'

function DurationIndicator({ segments }) {
  const total = calculateTotalMinutes(segments)
  const isOver = total > 480

  return (
    <div className={isOver ? 'text-red-600' : 'text-blue-600'}>
      {formatDuration(total)} of {formatDuration(480)}
    </div>
  )
}
```

### Conditional Office Field

```tsx
function SegmentEditor({ segment, statuses }) {
  const status = statuses.find(s => s.code === segment.statusCode)

  return (
    <>
      <StatusSelect value={segment.statusCode} onChange={...} />

      {status?.requiresOffice && (
        <OfficeSelect value={segment.officeCode} onChange={...} />
      )}
    </>
  )
}
```

### Handle Validation Errors

```typescript
try {
  const res = await fetch('/api/presence/plan-day', { ... })
  const data = await res.json()

  if (!res.ok && data.details) {
    // Map errors to form fields
    data.details.forEach(({ field, message }) => {
      if (field === 'segments') {
        setGeneralError(message)
      } else if (field.startsWith('segments[')) {
        const index = parseInt(field.match(/\[(\d+)\]/)[1])
        setSegmentError(index, message)
      }
    })
  }
} catch (error) {
  setGeneralError('Network error')
}
```

## Admin Operations

### Add New Status

```typescript
const newStatus = {
  code: 'VACATION',
  label: 'Vacation',
  category: 'time_off',
  requiresOffice: false,
  color: '#f59e0b',
  icon: 'Plane',
  isActive: true
}

await fetch('/api/presence/admin/status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newStatus)
})
```

### Toggle Status Active

```typescript
await fetch('/api/presence/admin/status', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'status-uuid',
    isActive: false
  })
})
```

### Add New Office

```typescript
const newOffice = {
  code: 'LAGUNA_BEACH',
  name: 'Laguna Beach',
  isActive: true
}

await fetch('/api/presence/admin/office', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newOffice)
})
```

## Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Bad request (invalid date format, etc.) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (trying to edit another user's schedule) |
| 409 | Conflict (duplicate status/office code) |
| 422 | Validation error (cap exceeded, overlap, etc.) |
| 500 | Server error |

## TypeScript Types

```typescript
interface StatusOption {
  code: string
  label: string
  color: string | null
  icon: string | null
  requiresOffice: boolean
}

interface OfficeOption {
  code: string
  name: string
}

interface Segment {
  statusCode: string
  officeCode?: string
  from: string // HH:mm
  to: string // HH:mm
  notes?: string // Max 500 chars
}

interface PlanDay {
  userId?: string // Defaults to current user
  date: string // YYYY-MM-DD
  repeatUntil?: string // YYYY-MM-DD (max 30 days)
  segments: Segment[]
}

interface ValidationError {
  field: string
  message: string
}
```

## Testing Scenarios

### Valid Schedule (8h)
```typescript
{
  date: '2025-01-20',
  segments: [
    { statusCode: 'REMOTE', from: '09:00', to: '11:00' }, // 2h
    { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '11:00', to: '17:00' } // 6h
  ]
}
// ✅ Total: 8h
```

### Invalid: Exceeds Cap
```typescript
{
  date: '2025-01-20',
  segments: [
    { statusCode: 'REMOTE', from: '09:00', to: '18:00' } // 9h
  ]
}
// ❌ Error: "Total duration 9.0h exceeds daily cap of 8.0h"
```

### Invalid: Overlaps
```typescript
{
  date: '2025-01-20',
  segments: [
    { statusCode: 'REMOTE', from: '09:00', to: '12:00' },
    { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '11:00', to: '15:00' }
  ]
}
// ❌ Error: "Overlaps with segment 1 (09:00–12:00)"
```

### Invalid: Missing Office
```typescript
{
  date: '2025-01-20',
  segments: [
    { statusCode: 'AVAILABLE', from: '09:00', to: '17:00' } // Missing officeCode
  ]
}
// ❌ Error: "Status 'Available' requires an office location"
```

## Need Help?

- **Full Docs**: See `docs/PRESENCE_SYSTEM.md`
- **Tests**: Check `tests/presence/` for more examples
- **UI Component**: See `components/PresencePlannerModal.tsx`
