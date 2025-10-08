# Phase 5: AI Provider Abstraction

## Summary

Implements clean provider abstraction layer for AI services, enabling swappable backends (OpenAI ↔ Anthropic) without code changes. Includes OpenAI provider with real implementation, Anthropic stub, and orchestration API. Zero breaking changes to existing functionality.

## Implementation Details

### 1. Domain Types (`modules/ai/domain.ts`)

**Provider Interface**:
```typescript
export interface Provider {
  name: string
  classify(input: ClassifyInput, opts?: ClassifyOptions): Promise<ClassifyResult>
  respond(input: RespondInput, opts?: RespondOptions): Promise<RespondResult>
}
```

**Input/Output DTOs**:
- `ClassifyInput`: `{ title, description }`
- `RespondInput`: `{ ticketId, ticketTitle, ticketDescription, ticketCategory?, ticketPriority? }`
- `ClassifyOptions`: `{ model?, temperature?, maxTokens? }`
- `RespondOptions`: `{ model?, temperature?, maxTokens?, tone? }`
- `ClassifyResult`: `{ category, confidence, reasoning? }`
- `RespondResult`: `{ response, confidence, reasoning? }`

### 2. Provider Selector (`modules/ai/provider.ts`)

**selectProvider(name, config): Provider**:
```typescript
export function selectProvider(
  providerName: 'openai' | 'anthropic',
  config: { apiKey: string, classifyModel?: string, respondModel?: string }
): Provider
```

- Returns appropriate provider instance based on name
- Throws error for unknown providers
- Used by orchestration functions to get configured provider

### 3. OpenAI Provider (`modules/ai/providers/openai.ts`)

**openaiProvider(config): Provider**:
- Real implementation using OpenAI SDK
- Default models: `gpt-4o-mini` for both classify and respond
- Error handling with fallback responses
- Preserves existing prompts from `lib/ai/categorization.js` and `lib/ai/response-generation.js`

**classify() implementation**:
```typescript
// Prompt engineering for ticket categorization
// JSON response format: { category, priority, confidence, reasoning }
// Fallback: { category: "General", confidence: 0.3 }
```

**respond() implementation**:
```typescript
// Prompt engineering for ticket response generation
// Markdown formatting with ## headings, **bold**, bullet points
// Fallback: Generic acknowledgment message
```

### 4. Anthropic Provider (`modules/ai/providers/anthropic.ts`)

**anthropicProvider(config): Provider**:
- Stub implementation with same interface as OpenAI
- Returns fallback responses
- Logs warning when used
- Ready for real Anthropic SDK integration

### 5. Orchestration Functions

**classify() (`modules/ai/classify.ts`)**:
```typescript
export async function classify(
  input: ClassifyInput,
  opts?: ClassifyOptions
): Promise<ClassifyResult> {
  const provider = selectProvider(config.AI_PROVIDER, { ... })
  return await provider.classify(input, opts)
}
```

**respond() (`modules/ai/respond.ts`)**:
```typescript
export async function respond(
  input: RespondInput,
  opts?: RespondOptions
): Promise<RespondResult> {
  const provider = selectProvider(config.AI_PROVIDER, { ... })
  return await provider.respond(input, opts)
}
```

### 6. Configuration (`lib/config.ts`) - NEW

```typescript
export const config = {
  AI_PROVIDER: (process.env.AI_PROVIDER || 'openai') as 'openai' | 'anthropic',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  AI_CLASSIFY_MODEL: process.env.AI_CLASSIFY_MODEL || 'gpt-4o-mini',
  AI_RESPOND_MODEL: process.env.AI_RESPOND_MODEL || 'gpt-4o-mini',
  validate() { ... }
}
```

## Usage Example

### Before (Direct SDK usage):
```javascript
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const completion = await openai.chat.completions.create({ ... })
```

### After (Provider abstraction):
```typescript
import * as ai from '@/modules/ai'

// Classify ticket
const result = await ai.classify({
  title: 'Printer not working',
  description: 'Printer is offline',
})

// Generate response
const response = await ai.respond({
  ticketId: 'T-001',
  ticketTitle: 'Printer not working',
  ticketDescription: 'Printer is offline',
  ticketCategory: 'Hardware',
  ticketPriority: 'NORMAL',
})
```

## Testing Results

### ✅ All Tests Passing: 102/102

```
✓ tests/phase5-ai-abstraction.test.ts (19 tests) 10ms
✓ tests/phase4-tickets-service.test.ts (16 tests) 4ms
✓ tests/phase2-scaffold.test.ts (30 tests) 6ms
✓ tests/phase3-auth-rbac.test.ts (37 tests) 9ms

Test Files  4 passed (4)
Tests       102 passed (102)
Duration    518ms
```

**New Phase 5 Tests (19)**:
- Domain Types (3 tests)
- Provider Selection (3 tests)
- OpenAI Provider (4 tests)
- Anthropic Provider (2 tests)
- Orchestration Functions (2 tests)
- Module Exports (5 tests)

### ✅ Build Successful: 45/45 Routes

```
✓ Compiled successfully
✓ Generating static pages (45/45)
```

## Breaking Changes

**None**. All existing code continues to work:
- Legacy `LLMProvider` interface preserved
- Existing `lib/openai.js` functions unchanged
- Phase 2 scaffold tests updated to expect "Phase 5" in error messages

## Environment Variables

**Required**:
- `OPENAI_API_KEY` (when `AI_PROVIDER=openai`, default)

**Optional**:
- `AI_PROVIDER` (default: `openai`, options: `openai|anthropic`)
- `ANTHROPIC_API_KEY` (when `AI_PROVIDER=anthropic`)
- `AI_CLASSIFY_MODEL` (default: `gpt-4o-mini`)
- `AI_RESPOND_MODEL` (default: `gpt-4o-mini`)

## Files Changed

**Created (3)**:
- `lib/config.ts` - Centralized configuration
- `modules/ai/provider.ts` - Provider selector
- `tests/phase5-ai-abstraction.test.ts` - Test suite

**Modified (6)**:
- `modules/ai/domain.ts` - Added Provider interface and DTOs
- `modules/ai/classify.ts` - Orchestration function
- `modules/ai/respond.ts` - Orchestration function
- `modules/ai/providers/openai.ts` - Real implementation
- `modules/ai/providers/anthropic.ts` - Stub implementation
- `modules/ai/index.ts` - Export provider selector
- `tests/phase2-scaffold.test.ts` - Updated legacy test

## Risk Assessment

**Risk Level**: Low

**Mitigations**:
- No breaking changes (existing code untouched)
- Comprehensive test coverage (19 new tests)
- Type safety with TypeScript
- Error handling with fallbacks in all providers
- Mock-based tests (no network calls)

## Next Steps (Future)

**Refactor Existing Call Sites** (not in this PR):
- `lib/openai.js` → use `modules/ai`
- `lib/ai/categorization.js` → use `ai.classify()`
- `lib/ai/response-generation.js` → use `ai.respond()`
- `app/api/tickets/[id]/generate-draft/route.js` → use `ai.respond()`
- `app/api/keywords/suggestions/route.js` → use `ai.classify()`

## Metrics

- **Files Created**: 3
- **Files Modified**: 6
- **Lines Added**: ~600
- **Test Cases**: 19 new
- **Test Pass Rate**: 100% (102/102)
- **Build Success**: ✅ (45/45 routes)
- **Type Errors**: 0

---

**Ready for Review** ✅
