# Staff Presence System V2 - Technical Documentation

## Overview

The Staff Presence System is a data-driven, extensible scheduling platform that allows staff members to plan their daily schedules across multiple statuses (Remote, Available, Vacation, etc.) and office locations. The system enforces business rules like an 8-hour daily cap, prevents overlaps, and requires specific validations per status type.

## Architecture

The system follows clean architecture principles with clear separation of concerns:

```
├── prisma/
│   ├── schema.prisma                 # Database schema (lookup tables)
│   ├── migrations/                   # Versioned schema changes
│   └── seeds/presence.ts             # Baseline data seeding
│
├── lib/presence/                     # Domain layer (business logic)
│   ├── registry.ts                   # 60s-cached options provider
│   ├── validation.ts                 # Zod schemas + business rules
│   ├── service.ts                    # Core domain functions
│   └── timezone.ts                   # UTC ↔ Local time conversion
│
├── app/api/presence/                 # API layer (Next.js routes)
│   ├── options/route.ts              # GET active statuses/offices
│   ├── day/route.ts                  # GET segments for a date
│   ├── plan-day/route.ts             # POST create/replace segments
│   ├── segment/[id]/route.ts         # DELETE single segment
│   └── admin/
│       ├── status/route.ts           # POST/PATCH manage statuses
│       └── office/route.ts           # POST/PATCH manage offices
│
├── components/
│   └── PresencePlannerModal.tsx      # UI component (multi-segment editor)
│
└── tests/presence/                   # Test suite
    ├── validation.test.ts            # Unit tests for business rules
    ├── service.test.ts               # Service layer integration tests
    └── e2e.test.ts                   # End-to-end acceptance tests
```

## Database Schema

### Data-Driven Design

The system uses **lookup tables** instead of hardcoded enums to allow admins to add/edit statuses and offices without code changes.

#### PresenceStatusType
```prisma
model PresenceStatusType {
  id             String          @id @default(uuid())
  code           String          @unique       // e.g., "AVAILABLE", "REMOTE"
  label          String                        // Display name: "Available"
  category       String                        // "presence" or "time_off"
  requiresOffice Boolean         @default(false)
  color          String?                       // Hex color for UI
  icon           String?                       // Icon name for UI
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  staffPresence  StaffPresence[]
}
```

#### PresenceOfficeLocation
```prisma
model PresenceOfficeLocation {
  id            String          @id @default(uuid())
  code          String          @unique       // e.g., "NEWPORT_BEACH"
  name          String                        // "Newport Beach"
  isActive      Boolean         @default(true)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  staffPresence StaffPresence[]
}
```

#### StaffPresence
```prisma
model StaffPresence {
  id               String                    @id @default(uuid())
  userId           String
  statusId         String                    // FK → PresenceStatusType
  officeLocationId String?                   // FK → PresenceOfficeLocation
  notes            String?                   // Max 500 chars
  startAt          DateTime                  // UTC timestamp
  endAt            DateTime                  // UTC timestamp
  createdAt        DateTime                  @default(now())
  updatedAt        DateTime                  @updatedAt

  user             User                      @relation(...)
  status           PresenceStatusType        @relation(...)
  officeLocation   PresenceOfficeLocation?   @relation(...)

  @@unique([userId, startAt, endAt, statusId, officeLocationId])
  @@index([userId, startAt])
}
```

### Indexes

- **Btree**: `(userId, startAt)` for fast day/week queries
- **Unique**: Prevents exact duplicate segments
- **Partial**: Active-only lookups on status/office tables (see `add_presence_indexes.sql`)

## Business Rules

### 1. Daily Cap (MAX_DAY_MINUTES)
- Default: **480 minutes (8 hours)**
- Applies to sum of all segments per calendar day
- Enforced at validation layer before DB write

**Example:**
```typescript
// ✅ Accepted: 2h + 6h = 8h
[
  { statusCode: 'REMOTE', from: '09:00', to: '11:00' },
  { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '11:00', to: '17:00' }
]

// ❌ Rejected: 9h exceeds cap
[
  { statusCode: 'REMOTE', from: '09:00', to: '18:00' }
]
```

### 2. No Overlaps
- Segments for the same user cannot overlap within a request
- Overlaps are detected by comparing time ranges in minutes since midnight

**Example:**
```typescript
// ❌ Rejected: 10:00-12:00 overlaps
[
  { statusCode: 'REMOTE', from: '09:00', to: '12:00' },
  { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '10:00', to: '14:00' }
]

// ✅ Accepted: Adjacent segments (no gap or overlap)
[
  { statusCode: 'REMOTE', from: '09:00', to: '12:00' },
  { statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '12:00', to: '17:00' }
]
```

### 3. No Midnight Crossing
- Time ranges must be within the same calendar day
- `to` must be > `from` (same time is invalid)

**Example:**
```typescript
// ❌ Rejected: Crosses midnight
{ statusCode: 'REMOTE', from: '22:00', to: '02:00' }

// ✅ Accepted: Within same day
{ statusCode: 'REMOTE', from: '09:00', to: '17:00' }
```

### 4. Office Requirement
- Statuses with `requiresOffice: true` must have an `officeCode`
- Validated by checking the `PresenceStatusType` record

**Example:**
```typescript
// ❌ Rejected: AVAILABLE requires office
{ statusCode: 'AVAILABLE', from: '09:00', to: '17:00' }

// ✅ Accepted: Office provided
{ statusCode: 'AVAILABLE', officeCode: 'NEWPORT_BEACH', from: '09:00', to: '17:00' }

// ✅ Accepted: REMOTE doesn't require office
{ statusCode: 'REMOTE', from: '09:00', to: '17:00' }
```

### 5. Duplicate Prevention
- Unique constraint on `(userId, startAt, endAt, statusId, officeLocationId)`
- Prevents exact duplicates at DB level

### 6. Repeat Range Limit (MAX_RANGE_DAYS)
- Default: **30 days**
- When using `repeatUntil`, range must be ≤ MAX_RANGE_DAYS

## API Reference

### Public Endpoints

#### `GET /api/presence/options`
Returns active statuses and offices for UI dropdowns.

**Response:**
```json
{
  "statuses": [
    {
      "code": "AVAILABLE",
      "label": "Available",
      "color": "#22c55e",
      "icon": "Check",
      "requiresOffice": true
    },
    {
      "code": "REMOTE",
      "label": "Remote",
      "color": "#3b82f6",
      "icon": "Laptop",
      "requiresOffice": false
    }
  ],
  "offices": [
    {
      "code": "NEWPORT_BEACH",
      "name": "Newport Beach"
    }
  ]
}
```

#### `GET /api/presence/day?userId=xxx&date=YYYY-MM-DD`
Fetch segments for a specific user and date.

**Auth:** User can view own schedule; admin can view any.

**Response:**
```json
{
  "segments": [
    {
      "id": "uuid",
      "statusCode": "REMOTE",
      "statusLabel": "Remote",
      "statusColor": "#3b82f6",
      "from": "09:00",
      "to": "12:00",
      "notes": null
    },
    {
      "id": "uuid",
      "statusCode": "AVAILABLE",
      "statusLabel": "Available",
      "officeCode": "NEWPORT_BEACH",
      "officeName": "Newport Beach",
      "from": "13:00",
      "to": "17:00",
      "notes": "Meeting with team"
    }
  ]
}
```

#### `POST /api/presence/plan-day`
Create or replace segments for a day (or multiple days with `repeatUntil`).

**Auth:** User can plan own schedule; admin can plan for others.

**Request:**
```json
{
  "userId": "optional-uuid",
  "date": "2025-01-20",
  "repeatUntil": "2025-01-22",
  "segments": [
    {
      "statusCode": "REMOTE",
      "from": "09:00",
      "to": "12:00",
      "notes": "Focus time"
    },
    {
      "statusCode": "AVAILABLE",
      "officeCode": "NEWPORT_BEACH",
      "from": "13:00",
      "to": "17:00"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "createdIds": ["uuid1", "uuid2"],
  "daysAffected": 3
}
```

**Errors:**
- `422 Unprocessable Entity` - Validation failed (cap, overlap, invalid status/office)
- `403 Forbidden` - Trying to edit another user's schedule (non-admin)
- `500 Internal Server Error` - Database/unexpected error

**Example Error Response:**
```json
{
  "error": "Business rule validation failed",
  "details": [
    {
      "field": "segments",
      "message": "Total duration 9.0h exceeds daily cap of 8.0h"
    }
  ]
}
```

#### `DELETE /api/presence/segment/:id`
Delete a single segment.

**Auth:** User can delete own segments; admin can delete any.

**Response:**
```json
{
  "success": true
}
```

### Admin Endpoints

#### `POST /api/presence/admin/status`
Create a new presence status type.

**Auth:** Admin only

**Request:**
```json
{
  "code": "SICK",
  "label": "Sick",
  "category": "time_off",
  "requiresOffice": false,
  "color": "#ef4444",
  "icon": "HeartPulse",
  "isActive": true
}
```

#### `PATCH /api/presence/admin/status`
Update an existing status (e.g., toggle active, change label).

**Auth:** Admin only

**Request:**
```json
{
  "id": "uuid",
  "isActive": false
}
```

#### `POST /api/presence/admin/office`
Create a new office location.

**Auth:** Admin only

**Request:**
```json
{
  "code": "LAGUNA_BEACH",
  "name": "Laguna Beach",
  "isActive": true
}
```

#### `PATCH /api/presence/admin/office`
Update an existing office.

**Auth:** Admin only

**Request:**
```json
{
  "id": "uuid",
  "name": "Laguna Beach HQ"
}
```

## Domain Layer (lib/presence)

### registry.ts
**Purpose:** In-memory cache (60s TTL) of active statuses and offices.

**Key Functions:**
- `getPresenceOptions()` - Returns `{ statuses, offices }` for UI
- `resolveStatus(code)` - Lookup status by code
- `resolveOffice(code)` - Lookup office by code
- `bustRegistryCache()` - Clear cache (called after admin mutations)

### validation.ts
**Purpose:** Zod schemas + business rule validation.

**Key Functions:**
- `validateSegments(segments)` - Checks cap, overlaps, midnight, office requirement
- `validatePlanDay(plan)` - Validates repeatUntil range + calls validateSegments
- `calculateTotalMinutes(segments)` - Sum of durations
- `calculateRemainingMinutes(segments)` - MAX_DAY_MINUTES - total
- `formatDuration(minutes)` - "8h", "30m", "1h 30m"

### service.ts
**Purpose:** Core business logic (DB transactions).

**Key Functions:**
- `planDay(userId, plan)` - Delete existing segments for day(s), create new ones (atomic transaction)
- `getDay(userId, date)` - Fetch segments for a date, convert UTC → local time
- `deleteSegment(userId, segmentId)` - Delete with ownership check
- `getWeekView(userId, startDate)` - 7-day view with merged schedules
- `getCurrentPresences(userIds?)` - Active presences at current time (deduplicated)

### timezone.ts
**Purpose:** UTC ↔ Local time conversion (using `date-fns-tz`).

**Key Functions:**
- `localToUTC(dateStr, timeStr)` - "2025-01-20" + "09:00" → UTC Date
- `utcToLocalTime(utcDate)` - UTC Date → "09:00"
- `getLocalDayWindow(dateStr)` - Returns `{ start: UTC 00:00, end: UTC 23:59:59 }`
- `crossesMidnight(from, to)` - Checks if `to <= from`

## UI Component

### PresencePlannerModal.tsx
**Features:**
- Multi-segment day editor
- Date picker with optional "Repeat until" (max 30 days)
- Live 8h validation indicator (red if exceeded)
- Dynamic office field (only shows if status `requiresOffice`)
- Validation errors displayed per field
- Add/remove segments

**Usage:**
```tsx
<PresencePlannerModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  userId={userId} // Optional, defaults to current user
  onSuccess={() => {
    // Refresh schedule data
  }}
/>
```

## Testing

### Running Tests

```bash
# Run all presence tests
npm test -- tests/presence/

# Run specific test file
npm test -- tests/presence/validation.test.ts

# Run with coverage
npm test -- --coverage tests/presence/
```

### Test Coverage

1. **Unit Tests** (`validation.test.ts`)
   - Time calculations (total, remaining, format)
   - Daily cap enforcement
   - Overlap detection
   - Midnight crossing prevention
   - Office requirement validation
   - repeatUntil range validation
   - Multiple error scenarios

2. **Service Tests** (`service.test.ts`)
   - planDay transaction guarantees
   - Segment replacement logic
   - Multi-day repeat functionality
   - getDay UTC → local conversion
   - deleteSegment authorization
   - getWeekView merging and grouping
   - getCurrentPresences deduplication

3. **E2E Tests** (`e2e.test.ts`)
   - Acceptance criteria scenarios
   - Complex real-world workflows
   - Error handling and rollback
   - Multi-day scheduling

## Environment Configuration

Add these variables to `.env`:

```bash
# Presence System Configuration
APP_TZ="America/Los_Angeles"
MAX_DAY_MINUTES="480"
MAX_RANGE_DAYS="30"
PRESENCE_V2_ENABLED="true"
```

**Variables:**
- `APP_TZ` - Timezone for date calculations (default: America/Los_Angeles)
- `MAX_DAY_MINUTES` - Daily cap in minutes (default: 480 = 8 hours)
- `MAX_RANGE_DAYS` - Maximum repeat range in days (default: 30)
- `PRESENCE_V2_ENABLED` - Feature flag (default: true)

## Deployment Checklist

1. ✅ Run migration: `npx prisma migrate deploy`
2. ✅ Generate Prisma client: `npx prisma generate`
3. ✅ Seed baseline data: `npx tsx prisma/seeds/presence.ts`
4. ✅ (Optional) Add performance indexes: `psql $DATABASE_URL < prisma/migrations/add_presence_indexes.sql`
5. ✅ Run tests: `npm test -- tests/presence/`
6. ✅ Update environment variables
7. ✅ Deploy application

## Backward Compatibility

The system maintains backward compatibility by:
- Not removing existing presence-related routes
- Using database constraints that allow gradual migration
- Keeping all existing API responses intact
- Feature flag (`PRESENCE_V2_ENABLED`) for staged rollout

## Performance Considerations

1. **Registry Cache** - 60s TTL reduces DB queries for status/office lookups
2. **Indexes** - Btree on `(userId, startAt)` for fast queries
3. **Partial Indexes** - Active-only lookups on status/office tables
4. **Transaction Batching** - planDay uses single transaction for all days
5. **Unique Constraints** - Prevent duplicates at DB level (no app-level check needed)

## Future Enhancements

- [ ] GiST index for database-level overlap checking (requires `btree_gist` extension)
- [ ] Soft-delete support with `isActive` column on `staff_presence`
- [ ] Historical presence analytics (most common schedules, office utilization)
- [ ] Bulk operations (plan for entire team, copy week template)
- [ ] Calendar integrations (Google Calendar, Outlook)
- [ ] Mobile app support
- [ ] Notifications for schedule changes

## Support

For issues or questions:
1. Check test files for usage examples
2. Review API responses for error details
3. Enable debug logging: `DEBUG=presence:* npm run dev`
4. Contact the development team

## License

Internal use only - Surterre Properties
