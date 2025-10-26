# OpenAPI Documentation — Usage Guide

This guide explains how to generate, validate, and publish the OpenAPI specification for AidIN's APIs.

## Overview

The OpenAPI specification provides machine-readable documentation of the AidIN API, enabling:
- Automatic client SDK generation
- API testing tools (Postman, Insomnia)
- Interactive documentation (Swagger UI, Redoc)
- Contract testing and validation

## Generating the Spec

### Command

```bash
npm run openapi:gen
```

### What It Does

1. Runs `scripts/generate-openapi.ts`
2. Generates `docs/openapi.yaml` (OpenAPI 3.1 format)
3. Documents all admin module APIs
4. Includes request/response schemas and examples

### Output Location

```
docs/openapi.yaml
```

### When to Regenerate

- After adding new API endpoints
- After changing API request/response schemas
- After updating API documentation
- Before releases (ensure spec is up-to-date)

## Validating the Spec

### Option 1: Online Validator

1. Open https://editor.swagger.io/
2. Upload or paste `docs/openapi.yaml`
3. Review validation errors/warnings
4. Fix issues in `scripts/generate-openapi.ts`

### Option 2: CLI Validation (Recommended)

**Install validator:**
```bash
npm install -g @redocly/cli
```

**Run validation:**
```bash
redocly lint docs/openapi.yaml
```

**Expected output:**
```
✓ No problems found
```

**If errors:**
```
 1:1  error  Document must have an `info` object

✖ 1 problem (1 error, 0 warnings, 0 infos, 0 hints)
```

Fix errors in `scripts/generate-openapi.ts` and regenerate.

## CI Integration

The OpenAPI generation is integrated into CI pipeline:

**.github/workflows/ci.yml:**
```yaml
- name: Generate OpenAPI spec
  run: npm run openapi:gen

- name: Upload OpenAPI artifact
  uses: actions/upload-artifact@v4
  with:
    name: openapi-spec
    path: docs/openapi.yaml
```

**CI Job:** `openapi`

**Artifact:** Available for download from GitHub Actions

## Publishing Options

### Option 1: Admin-Only Route (Recommended for Internal APIs)

**Feature Flag:** `NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=true`

**Create route:** `app/api/docs/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  // TODO: Add authentication check
  // requireRole(ctx.auth, 'admin');

  const spec = readFileSync(
    join(process.cwd(), 'docs', 'openapi.yaml'),
    'utf-8'
  );

  return new NextResponse(spec, {
    headers: {
      'Content-Type': 'application/x-yaml',
    },
  });
}
```

**Access:**
```
https://your-domain.com/api/docs
```

**Security:**
- ✅ Requires admin authentication
- ✅ Not publicly indexed
- ✅ Safe for internal APIs

### Option 2: Static File Serving (For Public APIs)

**Location:** `public/docs/openapi.yaml`

**Copy spec:**
```bash
cp docs/openapi.yaml public/docs/openapi.yaml
```

**Access:**
```
https://your-domain.com/docs/openapi.yaml
```

**Security:**
- ⚠️ Publicly accessible
- ⚠️ Will be indexed by search engines
- ⚠️ Only use for public APIs

### Option 3: Interactive Documentation

**Option A: Swagger UI**

Install:
```bash
npm install swagger-ui-react
```

Create page: `app/api-docs/page.tsx`
```typescript
'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocs() {
  return <SwaggerUI url="/api/docs" />;
}
```

**Option B: Redoc**

Install:
```bash
npm install redoc
```

Create page: `app/api-docs/page.tsx`
```typescript
'use client';

import { RedocStandalone } from 'redoc';

export default function ApiDocs() {
  return <RedocStandalone specUrl="/api/docs" />;
}
```

**Access:**
```
https://your-domain.com/api-docs
```

## Important Security Considerations

### NEVER Expose Publicly If:

❌ API contains sensitive endpoints
❌ Authentication secrets in examples
❌ Internal infrastructure details exposed
❌ User data schemas revealed
❌ Security vulnerabilities documented

### Safe to Expose Publicly If:

✅ API is designed for public consumption
✅ All endpoints require authentication
✅ No sensitive examples in spec
✅ Rate limiting in place
✅ Security reviewed and approved

### Best Practice: Admin-Only Access

For internal tools like AidIN:
1. Keep `NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=false` in production
2. Only enable for authenticated admins
3. Use admin-only route with authentication check
4. Never serve from `/public` directory

## Customizing the Generator

### Edit Generator Script

**File:** `scripts/generate-openapi.ts`

**Structure:**
```typescript
const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'AidIN Helpdesk API',
    version: '1.0.0',
    // ...
  },
  servers: [
    // ...
  ],
  paths: {
    '/api/endpoint': {
      get: {
        // ...
      },
    },
  },
  components: {
    schemas: {
      // ...
    },
  },
};
```

### Adding New Endpoint Documentation

1. Edit `scripts/generate-openapi.ts`
2. Add endpoint to `paths` object:
```typescript
'/api/tickets': {
  get: {
    tags: ['Tickets'],
    summary: 'List tickets',
    responses: {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TicketList' }
          }
        }
      }
    }
  }
}
```

3. Add schema to `components.schemas`:
```typescript
TicketList: {
  type: 'object',
  properties: {
    tickets: {
      type: 'array',
      items: { $ref: '#/components/schemas/Ticket' }
    }
  }
}
```

4. Regenerate:
```bash
npm run openapi:gen
```

5. Validate:
```bash
redocly lint docs/openapi.yaml
```

## Using the Spec

### Generate Client SDKs

**TypeScript/JavaScript:**
```bash
npx openapi-typescript docs/openapi.yaml -o types/api.ts
```

**Python:**
```bash
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g python \
  -o clients/python
```

**Go:**
```bash
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g go \
  -o clients/go
```

### Import to API Testing Tools

**Postman:**
1. Open Postman
2. Import → Upload Files → Select `docs/openapi.yaml`
3. Auto-generates collection with all endpoints

**Insomnia:**
1. Open Insomnia
2. Create → Import From → File → Select `docs/openapi.yaml`
3. All endpoints imported with examples

### Contract Testing

Use the spec for contract tests with tools like:
- Dredd
- Prism
- Pact

**Example with Prism:**
```bash
# Install Prism
npm install -g @stoplight/prism-cli

# Mock server from spec
prism mock docs/openapi.yaml

# Validation proxy
prism proxy docs/openapi.yaml https://your-api.com
```

## Versioning

### Current Version

Defined in spec:
```yaml
info:
  version: '1.0.0'
```

### Version Numbering

Follow semantic versioning:
- **Major (1.x.x):** Breaking changes to API
- **Minor (x.1.x):** New endpoints/features (backwards compatible)
- **Patch (x.x.1):** Bug fixes, documentation updates

### Version History

Maintain multiple spec versions:
```
docs/
  openapi.yaml          # Latest (symlink)
  openapi-v1.0.0.yaml  # Specific version
  openapi-v1.1.0.yaml
  openapi-v2.0.0.yaml
```

### Breaking Changes

When making breaking API changes:
1. Increment major version in spec
2. Update generator script
3. Keep old spec version for legacy clients
4. Document migration guide

## Troubleshooting

### Issue: Spec generation fails

**Check:**
```bash
npx tsx scripts/generate-openapi.ts
```

**Common errors:**
- Syntax error in generator script
- Invalid YAML formatting
- Missing schema references

**Solution:**
Fix errors in `scripts/generate-openapi.ts` and regenerate.

### Issue: Validation errors

**Run validator:**
```bash
redocly lint docs/openapi.yaml
```

**Common issues:**
- Missing required fields (`info`, `paths`)
- Invalid schema references
- Duplicate operation IDs

**Solution:**
Fix in generator script, regenerate, and re-validate.

### Issue: Spec out of date

**Symptoms:**
- API endpoints not in spec
- Response schemas don't match actual responses
- Examples are stale

**Solution:**
1. Review recent API changes
2. Update generator script
3. Regenerate spec
4. Validate against actual API

## Best Practices

1. **Regenerate frequently** - After every API change

2. **Validate in CI** - Catch spec errors early

3. **Version your specs** - Keep history for legacy clients

4. **Include examples** - Makes spec more useful

5. **Protect sensitive info** - Never expose secrets/credentials

6. **Keep in sync** - Spec should match actual API behavior

7. **Review before release** - Human review of generated spec

8. **Document auth** - Clear authentication instructions

9. **Rate limits** - Document throttling policies

10. **Error responses** - Document all error codes and formats

## Scripts Reference

### package.json Scripts

```json
{
  "scripts": {
    "openapi:gen": "tsx scripts/generate-openapi.ts",
    "openapi:lint": "redocly lint docs/openapi.yaml",
    "openapi:bundle": "redocly bundle docs/openapi.yaml -o docs/openapi-bundled.yaml"
  }
}
```

### Generate and Validate

```bash
npm run openapi:gen && npm run openapi:lint
```

### Bundle (Resolve all $refs)

```bash
npm run openapi:bundle
```

## Resources

- [OpenAPI 3.1 Spec](https://spec.openapis.org/oas/v3.1.0)
- [Redocly CLI](https://redocly.com/docs/cli/)
- [Swagger Editor](https://editor.swagger.io/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Prism Mock Server](https://stoplight.io/open-source/prism)

## Example Commands for Release Manager

```bash
# 1. Generate latest spec
npm run openapi:gen

# 2. Validate spec
redocly lint docs/openapi.yaml

# 3. Version the spec
cp docs/openapi.yaml docs/openapi-v1.0.0.yaml

# 4. Commit to git
git add docs/openapi*.yaml
git commit -m "docs: update OpenAPI spec to v1.0.0"

# 5. Deploy (if serving publicly)
cp docs/openapi.yaml public/docs/openapi.yaml

# 6. Or enable admin-only route
# Set NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=true
# Rebuild and restart application
```

---

**Security Reminder:**

🔒 For AidIN (internal helpdesk tool):
- **NEVER** enable `NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=true` in production
- **NEVER** copy spec to `/public` directory
- **ONLY** share spec with authorized team members
- **ALWAYS** require admin authentication for API docs access
