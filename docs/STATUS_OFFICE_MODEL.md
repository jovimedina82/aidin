# Status & Office Location Model

## Overview

The Presence Module uses **database lookup tables** instead of hard-coded TypeScript enums for status types and office locations. This design enables runtime extensibility and supports the business requirement for dynamic configuration.

## Why Lookup Tables Instead of Enums?

### Hard-coded Enums (Anti-pattern)

```typescript
// ❌ This requires code changes and deployment for every new status
enum PresenceStatus {
  AVAILABLE = 'AVAILABLE',
  VACATION = 'VACATION',
  SICK = 'SICK',
  // Adding "MATERNITY_LEAVE" requires:
  // 1. Code change
  // 2. Type regeneration
  // 3. Full deployment
}
```

### Lookup Tables (Current approach)

```typescript
// ✅ Admins can add new statuses via API without code changes
const status = await prisma.presenceStatusType.create({
  data: {
    code: 'MATERNITY_LEAVE',
    label: 'Maternity Leave',
    category: 'time_off',
    requiresOffice: false,
    color: '#ec4899',
    icon: 'Baby',
    isActive: true,
  }
})
```

**Benefits:**
- **Runtime Extensibility**: Admins can add/modify statuses without developer intervention
- **Soft-Delete**: Deactivate statuses without breaking existing data (`isActive: false`)
- **Rich Metadata**: Store UI-specific fields (color, icon) alongside business logic (`requiresOffice`)
- **Audit Trail**: Track when statuses were created/modified
- **Multi-tenancy Ready**: Different organizations can have different status sets

## Database Schema

### PresenceStatusType (Status Lookup)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `code` | String | Unique code (e.g., "AVAILABLE") |
| `label` | String | Display name (e.g., "Available") |
| `category` | String | Grouping category (e.g., "presence", "time_off") |
| `requiresOffice` | Boolean | Whether this status requires an office location |
| `color` | String? | Hex color for UI badges (#22c55e) |
| `icon` | String? | Icon name for UI (Lucide React icon name) |
| `isActive` | Boolean | Soft-delete flag |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Indexes:**
- `code` (unique)
- `isActive` (for filtering active statuses)

### PresenceOfficeLocation (Office Lookup)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `code` | String | Unique code (e.g., "NEWPORT_BEACH") |
| `name` | String | Display name (e.g., "Newport Beach") |
| `isActive` | Boolean | Soft-delete flag |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Indexes:**
- `code` (unique)
- `isActive` (for filtering active offices)

### StaffPresence (Schedule Data)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `userId` | UUID | Foreign key → User |
| `statusId` | UUID | Foreign key → PresenceStatusType |
| `officeLocationId` | UUID? | Foreign key → PresenceOfficeLocation |
| `notes` | String? | Optional notes (max 500 chars) |
| `startAt` | DateTime | UTC timestamp (start of segment) |
| `endAt` | DateTime | UTC timestamp (end of segment) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Foreign Key Constraints:**
- `statusId`: `onDelete: Restrict` (prevent deleting referenced statuses)
- `officeLocationId`: `onDelete: Restrict` (prevent deleting referenced offices)
- `userId`: `onDelete: Cascade` (delete presence when user is deleted)

**Indexes:**
- `[userId, startAt]` (for day queries)
- `statusId` (for filtering by status)
- `officeLocationId` (for filtering by office)

## Seed Data

The following baseline data is seeded on initial migration:

### Statuses

| Code | Label | Category | Requires Office | Color | Icon |
|------|-------|----------|----------------|-------|------|
| `AVAILABLE` | Available | presence | ✅ Yes | #22c55e | Check |
| `WORKING_REMOTE` | Working Remote | presence | ❌ No | #3b82f6 | Home |
| `REMOTE` | Remote | presence | ❌ No | #8b5cf6 | Laptop |
| `VACATION` | Vacation | time_off | ❌ No | #f59e0b | Plane |
| `SICK` | Sick | time_off | ❌ No | #ef4444 | HeartPulse |

### Offices

| Code | Name |
|------|------|
| `NEWPORT_BEACH` | Newport Beach |

## How to Add New Statuses or Offices

### Option 1: Via Admin API (Production)

#### Add a New Status

```bash
POST /api/presence/admin/status

{
  "code": "MATERNITY_LEAVE",
  "label": "Maternity Leave",
  "category": "time_off",
  "requiresOffice": false,
  "color": "#ec4899",
  "icon": "Baby",
  "isActive": true
}
```

**Requirements:**
- Admin role (Manager or Admin)
- Unique `code`
- Valid hex color (optional)
- Valid Lucide React icon name (optional)

#### Add a New Office

```bash
POST /api/presence/admin/office

{
  "code": "LAGUNA_BEACH",
  "name": "Laguna Beach",
  "isActive": true
}
```

**Requirements:**
- Admin role
- Unique `code`

### Option 2: Via Prisma Studio (Development)

```bash
npm run db:studio
```

1. Navigate to `PresenceStatusType` or `PresenceOfficeLocation`
2. Click "Add record"
3. Fill in fields
4. Save

### Option 3: Via Seed File (Initial Setup)

Edit `prisma/seeds/presence.ts`:

```typescript
const statuses = [
  // ... existing statuses
  {
    code: 'MATERNITY_LEAVE',
    label: 'Maternity Leave',
    category: 'time_off',
    requiresOffice: false,
    color: '#ec4899',
    icon: 'Baby',
    isActive: true,
  },
]

const offices = [
  // ... existing offices
  {
    code: 'LAGUNA_BEACH',
    name: 'Laguna Beach',
    isActive: true,
  },
]
```

Then run:

```bash
node prisma/seeds/presence.ts
```

## Soft-Delete (Deactivating Statuses/Offices)

### Deactivate a Status

```bash
PATCH /api/presence/admin/status

{
  "id": "status-uuid",
  "isActive": false
}
```

**Effect:**
- Status removed from planner dropdown within 60 seconds (cache TTL)
- Existing schedules with this status continue to display
- New schedules cannot use this status

### Reactivate a Status

```bash
PATCH /api/presence/admin/status

{
  "id": "status-uuid",
  "isActive": true
}
```

## Registry Cache

Status and office lookups are cached for **60 seconds** to minimize database queries.

**Cache Busting:**
- Automatic: After any admin mutation (POST/PATCH)
- Manual: Call `bustRegistryCache()` (server-side only)

**Cache Logic:**
```typescript
// lib/presence/registry.ts
const CACHE_TTL = 60 * 1000 // 60 seconds

// Fetches from cache or refreshes if expired
const statuses = await getActiveStatuses()

// Bust cache after admin update
await prisma.presenceStatusType.update(...)
bustRegistryCache()
```

## Foreign Key Protection

Attempting to delete a status or office that's referenced by existing schedules will fail with a foreign key constraint error:

```sql
DELETE FROM presence_status_types WHERE id = 'xxx';
-- Error: foreign key constraint "staff_presence_status_id_fkey"
```

**Solution:** Soft-delete instead:

```sql
UPDATE presence_status_types SET is_active = false WHERE id = 'xxx';
```

## Business Rules

### requiresOffice Validation

If `status.requiresOffice = true`, users **must** select an office location:

```typescript
// ❌ Validation error
{
  statusCode: 'AVAILABLE', // requiresOffice=true
  officeCode: null,
  from: '09:00',
  to: '17:00'
}

// ✅ Valid
{
  statusCode: 'AVAILABLE',
  officeCode: 'NEWPORT_BEACH',
  from: '09:00',
  to: '17:00'
}
```

### Category Grouping

Statuses can be grouped by category for UI organization:

- **presence**: In-office or location-specific work
- **time_off**: Vacation, sick, personal days, etc.

Future enhancement: Filter planner options by category.

## Migration Guide

If you're migrating from the old enum-based system:

### Before (Enum)

```prisma
enum PresenceStatus {
  IN_OFFICE
  AVAILABLE
  WORKING_REMOTE
  VACATION
  SICK
}

model StaffPresence {
  status PresenceStatus
  officeLocation OfficeLocation?
}
```

### After (Lookup Tables)

```prisma
model PresenceStatusType {
  id             String          @id @default(uuid())
  code           String          @unique
  label          String
  requiresOffice Boolean         @default(false)
  isActive       Boolean         @default(true)
  // ...
}

model StaffPresence {
  statusId         String
  officeLocationId String?
  status           PresenceStatusType @relation(...)
  officeLocation   PresenceOfficeLocation? @relation(...)
}
```

**Migration Steps:**
1. Create new lookup tables
2. Seed baseline data
3. Migrate existing `StaffPresence` records:
   ```sql
   -- Map old enum values to new statusId
   UPDATE staff_presence sp
   SET status_id = (
     SELECT id FROM presence_status_types
     WHERE code = sp.status::text
   )
   ```
4. Drop old enum columns
5. Update application code to use `statusId` instead of `status`

## API Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/presence/options` | GET | Get active statuses & offices | Public |
| `/api/presence/plan-day` | POST | Create schedule | Authenticated |
| `/api/presence/day?userId&date` | GET | Get day schedule | Authenticated |
| `/api/presence/segment/:id` | DELETE | Delete segment | Authenticated |
| `/api/presence/admin/status` | POST | Create status | Admin |
| `/api/presence/admin/status` | PATCH | Update status | Admin |
| `/api/presence/admin/office` | POST | Create office | Admin |
| `/api/presence/admin/office` | PATCH | Update office | Admin |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_DAY_MINUTES` | 480 | Daily schedule cap (8 hours) |
| `MAX_RANGE_DAYS` | 30 | Max repeat range (30 days) |
| `APP_TZ` | America/Los_Angeles | Default timezone |

## Best Practices

1. **Always use codes, not IDs**: Reference statuses/offices by `code` in API requests (codes are stable, IDs are generated)
2. **Soft-delete only**: Never hard-delete statuses/offices with existing references
3. **Use semantic codes**: `MATERNITY_LEAVE` not `STATUS_7`
4. **Consistent colors**: Follow design system color palette
5. **Test before deploy**: Verify new statuses work in planner modal before announcing to users

## Troubleshooting

### "Status not found or inactive"

**Cause:** Status code doesn't exist or `isActive = false`

**Solution:**
```sql
SELECT * FROM presence_status_types WHERE code = 'YOUR_CODE';
UPDATE presence_status_types SET is_active = true WHERE code = 'YOUR_CODE';
```

### "Office required for this status"

**Cause:** Status has `requiresOffice = true` but no office was provided

**Solution:** Either:
1. Select an office in the planner, or
2. Update status: `UPDATE presence_status_types SET requires_office = false WHERE code = 'YOUR_CODE'`

### Cache not refreshing

**Cause:** Cache TTL hasn't expired yet

**Solution:** Wait 60 seconds or restart the application to force cache clear

## Future Enhancements

- Multi-tenancy: `organizationId` field in lookup tables
- Status dependencies: "AVAILABLE requires checked-in badge scan"
- Office capacity limits: "Newport Beach max 50 people"
- Custom categories: User-defined categories beyond "presence" and "time_off"
- Workflow rules: "Vacation requires manager approval"
