# **Repository Structure Audit Report**
**AIDIN Helpdesk – Authentication & SSO Integration Session**
**Date:** 2025-10-08
**Branch:** `main` (working directory has uncommitted changes)

---

## 1. Summary

This audit verifies the repository structure following a comprehensive authentication system rewrite and Azure SSO integration. The session introduced **new modular auth architecture** with Edge-compatible JWT handling, added Microsoft Entra ID SSO support with full profile sync, and established proper role-based access control utilities.

**Key Changes:**
- New `modules/auth/` directory created with Edge (jose) and Node (jsonwebtoken) JWT implementations
- 6 new TypeScript API routes in `app/api/auth/` (azure/login, dev-login, logout, me) + debug endpoint
- New utility `lib/role-utils.js` for consistent role handling
- Enhanced `lib/config.ts` with cookie options and base URL helpers
- Updated middleware to async Edge runtime compatibility
- Multiple UI component fixes for dual user format support (firstName/lastName vs name)

**Overall Assessment:** ✅ **COMPLIANT** with expected Next.js 14 App Router conventions. No files detected in random locations. All new modules follow established patterns.

---

## 2. Tree (Condensed)

```
app/
├── api/
│   ├── auth/
│   │   ├── azure/                    [NEW]
│   │   │   └── login/route.ts        [NEW - TypeScript]
│   │   ├── azure-callback/route.js   [MODIFIED]
│   │   ├── dev-login/route.ts        [NEW - TypeScript, replaced .js]
│   │   ├── login/route.js            [existing]
│   │   ├── logout/route.ts           [NEW - TypeScript, replaced .js]
│   │   ├── me/route.ts               [NEW - TypeScript, replaced .js]
│   │   ├── register/route.js         [existing]
│   │   └── sso-success/route.js      [MODIFIED]
│   ├── debug/                        [NEW]
│   │   └── session/route.ts          [NEW - for dev testing]
│   └── uploads/route.ts              [existing]
├── admin/page.js                     [MODIFIED - SSO config UI]
├── dashboard/page.js                 [MODIFIED - dual name format]
├── login/page.js                     [MODIFIED - redirect fix]
├── profile/page.js                   [MODIFIED - dual format]
└── tickets/...

components/
├── AuthProvider.jsx                  [MODIFIED - cookie auth]
├── Navbar.jsx                        [MODIFIED - role rendering]
└── UserProfileModal.jsx              [MODIFIED - initials]

lib/
├── auth.js                           [MODIFIED - dual cookie support]
├── config.ts                         [MODIFIED - cookieOptions, getBaseUrl]
├── role-utils.js                     [NEW - role extraction utilities]
├── http/                             [existing security utilities]
└── services/                         [existing]

modules/                              [NEW DIRECTORY]
└── auth/                             [NEW]
    ├── jwt-edge.ts                   [NEW - jose for Edge runtime]
    ├── jwt.ts                        [NEW - jsonwebtoken for API routes]
    └── middleware.ts                 [NEW - getCurrentUser helper]

middleware.ts                         [MODIFIED - async, Edge compatible]
```

---

## 3. Changes vs `main`

**Git Status:** Working directory has uncommitted changes (see below)

**Committed Changes (from main):**
```
A  .env.ci
M  .env.example
A  .eslintignore
A  .eslintrc.json
A  .github/workflows/ci.yml
A  ARCHITECTURE.md
A  CHANGELOG.md
A  MERGE_AND_RELEASE_INSTRUCTIONS.md
A  OPERATIONS.md
M  app/api/auth/azure-callback/route.js
A  app/api/auth/dev-login/route.js
M  app/api/auth/me/route.js
M  app/api/auth/sso-success/route.js
A  app/api/uploads/route.ts
M  app/login/page.js
A  components/ImageDropPaste.tsx
A  components/ImageGallery.tsx
A  lib/config.ts
A  lib/http/errors.ts
A  lib/http/ratelimit.ts
A  lib/http/security.ts
A  middleware.ts
A  scripts/sync-azure-user.ts
A  tests/smoke-rc1.test.ts
```

**Uncommitted Changes (current session):**
```
M  .claude/settings.local.json
M  .next-dev.log
M  app/admin/page.js               [SSO config UI]
M  app/api/auth/azure-callback/route.js  [profile photo sync]
D  app/api/auth/dev-login/route.js       [deleted old .js]
D  app/api/auth/logout/route.js          [deleted old .js]
D  app/api/auth/me/route.js              [deleted old .js]
M  app/api/auth/sso-success/route.js     [aidin_token cookie]
M  app/dashboard/page.js           [dual name format]
M  app/login/page.js               [redirect fixes]
M  app/profile/page.js             [dual format + roles]
M  components/AuthProvider.jsx     [cookie-based auth]
M  components/Navbar.jsx           [role rendering fix]
M  components/UserProfileModal.jsx [initials fix]
M  lib/auth.js                     [dual cookie support]
M  lib/config.ts                   [cookieOptions added]
M  middleware.ts                   [async Edge compatible]
M  package-lock.json               [jose, jsonwebtoken]
M  package.json                    [jose, jsonwebtoken]
M  yarn.lock

?? app/api/auth/azure/             [NEW SSO login]
?? app/api/auth/dev-login/route.ts [NEW TypeScript]
?? app/api/auth/logout/route.ts    [NEW TypeScript]
?? app/api/auth/me/route.ts        [NEW TypeScript]
?? app/api/debug/                  [NEW debug endpoint]
?? lib/role-utils.js               [NEW utility]
?? modules/                        [NEW auth module]
```

---

## 4. Convention Compliance

### ✅ **PASSED:**
1. **App Router Structure** - All routes follow `app/[route]/page.js` or `app/api/[route]/route.js` pattern
2. **API Routes** - All API routes in `app/api/` with proper `route.js|ts` naming
3. **Components** - All components in top-level `components/` directory with PascalCase naming
4. **Lib Utilities** - Utilities in `lib/` with kebab-case or service pattern naming
5. **Modules** - New `modules/auth/` follows modular architecture pattern
6. **TypeScript Migration** - New auth routes properly use `.ts` extension
7. **No Random Files** - All files in expected locations per Next.js conventions

### ⚠️ **OBSERVATIONS:**
1. **Mixed .js and .ts** - Some files in `app/api/auth/` are .js (azure-callback, sso-success, login, register) while newer ones are .ts (dev-login, logout, me, azure/login)
2. **Prisma Usage** - Multiple direct `new PrismaClient()` instantiations throughout codebase (see section 7)
3. **Hardcoded Emails** - `helpdesk@surterreproperties.com` appears 20+ times (mostly acceptable for helpdesk context)
4. **Production URL** - `helpdesk.surterreproperties.com` found in `next.config.js` CORS header (expected)

---

## 5. Potential Issues

### **None Critical** - All files properly placed

**Minor observations:**
1. **Deleted .js files not committed** - `app/api/auth/dev-login/route.js`, `logout/route.js`, `me/route.js` deleted but not staged
2. **Debug endpoint** - `app/api/debug/session/route.ts` should potentially be removed before production or gated behind env var
3. **Multiple env var naming conventions** - Both `AZURE_*` and `AZURE_AD_*` prefixes used (intentional for compatibility)
4. **Test coverage** - Only one test file: `tests/smoke-rc1.test.ts`

---

## 6. Edge/Node Boundaries ✅

**✅ CORRECT IMPLEMENTATION:**

### Edge Runtime (middleware.ts):
```typescript
// middleware.ts uses jose (Edge-compatible)
import { getCurrentUser } from '@/modules/auth/middleware';

// modules/auth/jwt-edge.ts
import * as jose from 'jose';  ✅
```

### Node.js Runtime (API routes):
```javascript
// app/api/auth/register/route.js
import jwt from 'jsonwebtoken';  ✅

// app/api/auth/login/route.js
import jwt from 'jsonwebtoken';  ✅

// modules/auth/jwt.ts
import jwt from 'jsonwebtoken';  ✅
```

**Verification:**
- ✅ `jose` only in `modules/auth/jwt-edge.ts`
- ✅ `jsonwebtoken` only in Node.js API routes and `modules/auth/jwt.ts`
- ✅ Middleware uses async Edge-compatible JWT verification
- ✅ No crypto module usage in middleware

---

## 7. Data Layer Boundaries ⚠️

**⚠️ CONVENTION VIOLATION DETECTED:**

Multiple files instantiate `new PrismaClient()` directly instead of using singleton from `lib/prisma.js`:

```
./app/api/keywords/suggestions/route.js:5
./app/api/categories/analytics/route.js:4
./prisma/seed.js:4                        [ACCEPTABLE - script]
./scripts/manual-azure-sync.js:19         [ACCEPTABLE - script]
./scripts/create-test-ticket.js:4         [ACCEPTABLE - script]
./scripts/setup-org-chart.js:3            [ACCEPTABLE - script]
./scripts/seed-test-data.js:4             [ACCEPTABLE - script]
./scripts/create-n8n-user.js:5            [ACCEPTABLE - script]
./lib/prisma.js:7                         [ACCEPTABLE - singleton]
./lib/ai/response-generation.js:206       [⚠️ SHOULD USE SINGLETON]
./lib/ai/knowledge-search.js:15           [⚠️ SHOULD USE SINGLETON]
./lib/ai/routing.js:15                    [⚠️ SHOULD USE SINGLETON]
./lib/openai.js:19                        [⚠️ SHOULD USE SINGLETON]
./lib/services/AzureSyncScheduler.js:5    [⚠️ SHOULD USE SINGLETON]
```

**Recommendation:** API routes and lib files should import from `lib/prisma.js` singleton to avoid connection pooling issues.

**Auth module compliance:** ✅ New auth routes don't directly use Prisma - they use `lib/auth.js` which properly uses the singleton.

---

## 8. Config and Env

### **New Environment Variables Introduced:**

```bash
# Auth & JWT (session work)
DEV_LOGIN_ENABLED=true
DEV_ADMIN_EMAIL=admin@surterreproperties.com
JWT_SECRET=dev_jwt_secret_value_at_least_32_chars_long_123456

# Base URLs (session work)
BASE_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Azure AD SSO (session work)
AZURE_AD_TENANT_ID=your-tenant-id-here
AZURE_AD_CLIENT_ID=your-client-id-here
AZURE_AD_CLIENT_SECRET=your-client-secret-here
NEXT_PUBLIC_AZURE_AD_TENANT_ID=...
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=...

# Graph API (session work)
GRAPH_SCOPE=https://graph.microsoft.com/.default
GRAPH_AUTH_URL=https://login.microsoftonline.com/.../oauth2/v2.0/token
GRAPH_API_BASE=https://graph.microsoft.com/v1.0

# Dev bypass flags (session work)
AUTH_DEV_BYPASS=true
NEXT_PUBLIC_AUTH_DEV_BYPASS=true
NEXT_PUBLIC_DEV_LOGIN=true
```

### **Config Files:**
- ✅ `lib/config.ts` - New helpers: `getBaseUrl()`, `cookieOptions()`
- ✅ `.env.example` - Updated with all new variables
- ✅ `.env.local` - Contains actual Azure credentials (not in repo)
- ✅ `.env.ci` - Added for CI/CD

**Security Check:** ✅ No secrets committed to git (only in .env.local which is gitignored)

---

## 9. Test Coverage Map

**Test Files Found:**
```
./tests/smoke-rc1.test.ts  [1 test file]
```

**Coverage Assessment:**
- ❌ **No auth module tests** - `modules/auth/jwt-edge.ts`, `jwt.ts`, `middleware.ts` untested
- ❌ **No API route tests** - New auth endpoints (dev-login, logout, me, azure/login) untested
- ❌ **No role-utils tests** - `lib/role-utils.js` untested
- ✅ **Smoke test exists** - Basic RC1 validation test present

**Recommendation:** Add test coverage for:
1. `modules/auth/jwt-edge.ts` - Edge JWT signing/verification
2. `modules/auth/jwt.ts` - Node JWT signing/verification
3. `lib/role-utils.js` - extractRoleNames, hasRole, isAdmin, isStaff
4. Auth flow integration tests (dev-login → dashboard, SSO flow)

---

## 10. Documentation Artifacts

**Root-Level Documentation:**
```
✅ README.md
✅ ARCHITECTURE.md           [NEW]
✅ CHANGELOG.md              [NEW]
✅ AI_FEATURES_GUIDE.md
✅ OPERATIONS.md             [NEW]
✅ RELEASE_NOTES.md          [NEW]
✅ MERGE_AND_RELEASE_INSTRUCTIONS.md  [NEW]
✅ POST_RELEASE_TODO.md      [NEW]
```

**Phase Documentation:**
```
❌ No phase-* folders found in root
✅ docs/reports/110-release-candidate/  [release documentation]
```

**Session-Specific Documentation:**
- ❌ No documentation created for auth rewrite in this session
- ⚠️ Auth architecture changes not yet documented in ARCHITECTURE.md
- ⚠️ New modules/auth/ module not documented

**Recommendation:** Add to ARCHITECTURE.md:
- Edge vs Node runtime JWT handling strategy
- modules/auth/ module description
- Cookie-based authentication flow diagram
- Role checking utility usage

---

## 11. Actionable Fixes Checklist

### **Optional Improvements (Non-Blocking):**

- [ ] **Commit staged deletions** - Stage and commit deleted .js files:
  ```bash
  git add app/api/auth/dev-login/route.js
  git add app/api/auth/logout/route.js
  git add app/api/auth/me/route.js
  ```

- [ ] **Replace direct Prisma instantiations** - Update these files to use `lib/prisma.js` singleton:
  - `lib/ai/response-generation.js:206`
  - `lib/ai/knowledge-search.js:15`
  - `lib/ai/routing.js:15`
  - `lib/openai.js:19`
  - `lib/services/AzureSyncScheduler.js:5`
  - `app/api/keywords/suggestions/route.js:5`
  - `app/api/categories/analytics/route.js:4`

- [ ] **Remove or gate debug endpoint** - Either delete `app/api/debug/session/route.ts` or gate behind:
  ```typescript
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  ```

- [ ] **Add test coverage** - Create tests for:
  - `modules/auth/jwt-edge.test.ts`
  - `modules/auth/jwt.test.ts`
  - `lib/role-utils.test.js`
  - `app/api/auth/dev-login/route.test.ts`

- [ ] **Update ARCHITECTURE.md** - Document:
  - modules/auth/ module purpose and structure
  - Edge vs Node JWT strategy
  - Role-based access control patterns
  - Cookie-based authentication flow

- [ ] **TypeScript migration** - Consider migrating remaining .js auth routes to .ts:
  - `app/api/auth/azure-callback/route.js`
  - `app/api/auth/sso-success/route.js`
  - `app/api/auth/login/route.js`
  - `app/api/auth/register/route.js`

---

## **Final Verdict: ✅ REPOSITORY STRUCTURE COMPLIANT**

All files are properly organized following Next.js 14 App Router conventions. The new `modules/auth/` directory follows expected modular architecture patterns. No files detected in random or unexpected locations. Edge/Node runtime boundaries correctly respected. Minor improvements recommended but no critical issues found.
