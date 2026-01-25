# TypeScript Errors Report

**Generated:** 2026-01-25 (Updated)
**Total Errors:** 718 (down from 869, -151 errors)
**Excluded:** `dev/**` and `src/wip/**` directories

> **Recent improvements:** Fixed all `version_string` column references, removed unused file imports, and integrated Prettier with ESLint.

---

## Summary by Error Type

| Error Code | Count | Description |
|------------|-------|-------------|
| **TS2339** | 678 | Property does not exist on type (usually `unknown` types) |
| **TS2551** | 54 | Property does not exist (with suggested alternative) |
| **TS2322** | 28 | Type is not assignable to target type |
| **TS2345** | 26 | Argument type is not assignable to parameter |
| **TS2304** | 18 | Cannot find name/variable |
| **TS2698** | 16 | Spread types may only be created from object types |
| **TS2739** | 8 | Type is missing required properties |
| **TS2367** | 8 | Condition always returns true/false |
| **TS2353** | 7 | Object literal may only specify known properties |
| **TS2740** | 5 | Type is missing properties (stricter than TS2739) |
| Other | 21 | Various edge case errors |

---

## Summary by Directory/Area

| Directory | Error Count | Primary Issues |
|-----------|-------------|----------------|
| **src/app/api** | 217 | Missing type definitions for API responses, `unknown` types from database queries |
| **src/features/quiz** | 105 | Quiz service and type mismatches, `unknown` types in quiz data |
| **src/shared/hooks** | 103 | Custom hooks returning/accepting `unknown` types |
| **src/app/(public)** | 88 | Public tools (abpath, cell-quiz) with untyped data structures |
| **src/shared/utils** | 88 | Utility functions with loose typing |
| **src/features/questions** | 88 | Question-related components and services with type mismatches |
| **src/shared/services** | 53 | Service layer with `unknown` return types |
| **src/app/(admin)** | 28 | Admin panel components with property access errors |
| **src/features/dashboard** | 24 | Dashboard services with type issues |
| **src/shared/components** | 22 | Shared components with prop type mismatches |
| **src/features/auth** | 22 | Auth form components |
| **src/app/(dashboard)** | 14 | User dashboard pages |
| Other areas | 17 | Various features |

---

## Top 20 Files by Error Count

| File | Errors | Category |
|------|--------|----------|
| `src/app/(public)/tools/abpath/page.tsx` | 130 | Pathology tools - untyped section/item data |
| `src/app/api/user/data/route.ts` | 74 | User data API - missing response types |
| `src/features/quiz/services/quiz-service.ts` | 65 | Quiz service - `unknown` types from DB |
| `src/shared/hooks/use-smart-abpath.ts` | 41 | Pathology tool hook - untyped data |
| `src/app/api/admin/fetch-references/route.ts` | 39 | Reference fetching API - external API types |
| `src/shared/utils/ai-response-parser.ts` | 34 | AI parsing - untyped AI responses |
| `src/app/api/content/demo-questions/route.ts` | 32 | Demo content API |
| `src/features/quiz/types/quiz-question.ts` | 23 | Quiz type definitions |
| `src/features/questions/components/compact-question-preview.tsx` | 23 | Question preview component |
| `src/features/questions/components/create-question-dialog.tsx` | 21 | Question creation dialog |
| `src/shared/utils/client-wsi-selection.ts` | 20 | Virtual slide selection utility |
| `src/shared/hooks/use-client-wsi-data.ts` | 20 | Virtual slide data hook |
| `src/shared/services/quiz-completion-handler.ts` | 17 | Quiz completion service |
| `src/shared/hooks/use-client-virtual-slides.ts` | 16 | Virtual slides hook |
| `src/features/dashboard/services/service.ts` | 16 | Dashboard service |
| `src/app/api/admin/ai-generate-question/route.ts` | 16 | AI question generation API |
| `src/features/questions/components/questions-table.tsx` | 14 | Questions table component |
| `src/features/questions/components/flagged-questions-table.tsx` | 14 | Flagged questions table |
| `src/app/api/admin/questions/[id]/route.ts` | 14 | Question detail API |
| `src/shared/utils/r2-url-transformer.ts` | 13 | R2 URL transformation utility |

---

## Error Categories & Root Causes

### 1. **Database Query Results (TS2339 - 60%+)**
**Root Cause:** Database queries returning `unknown` types, typically from Supabase

**Affected Areas:**
- API routes accessing database
- Service layer functions
- Hooks fetching data

**Example Patterns:**
```typescript
// Property 'name' does not exist on type 'unknown'
const data = await supabase.from('table').select('*')
const name = data.name // ❌ Error: data is unknown
```

**Fix Strategy:** Add explicit type assertions or type guards after database queries

---

### 2. **Type Mismatches in Admin Components (TS2551, TS2322)**
**Root Cause:** Components accessing properties that were renamed/refactored

**Affected Files:**
- `src/app/(admin)/admin/questions/[id]/edit/*.tsx`
- `src/app/(admin)/admin/my-questions/page.tsx`

**Common Errors:**
- `question_set` → should be `set`
- `categories` → should be `category`
- `image` → should be `images`
- `question_tags` → should be `tags`

**Fix Strategy:** Update property access to match current type definitions in `src/features/questions/types/questions.ts`

---

### 3. **React Hook Form Handler Signatures (TS2345)**
**Root Cause:** Custom submit handlers with extra parameters incompatible with `SubmitHandler` type

**Affected Files:**
- `src/app/(admin)/admin/questions/[id]/edit/edit-question-client.tsx`

**Example:**
```typescript
// Handler with custom parameter
const handleSubmit = async (data: FormData, overrideReviewerId?: string) => {...}

// Used with react-hook-form
form.handleSubmit(handleSubmit) // ❌ Error: incompatible signature
```

**Fix Strategy:** Use wrapper functions or currying for extra parameters

---

### 4. **Public Tool Type Safety (TS2339, TS2345)**
**Root Cause:** Large JSON data structures without type definitions

**Affected Files:**
- `src/app/(public)/tools/abpath/page.tsx` (130 errors)
- `src/app/(public)/tools/cell-quiz/page.tsx` (40+ errors)

**Fix Strategy:** Create proper TypeScript interfaces for `PathologySection`, `PathologyItem`, `CellData`, etc.

---

### 5. **Quiz System Type Issues (TS2339, TS2740)**
**Root Cause:** Complex quiz state management with loosely typed data

**Affected Files:**
- `src/features/quiz/services/quiz-service.ts`
- `src/app/(dashboard)/dashboard/quiz/[id]/page.tsx`
- `src/shared/services/quiz-completion-handler.ts`

**Fix Strategy:** Define comprehensive types for quiz sessions, questions, and results

---

### 6. **External API Response Types (TS2339)**
**Root Cause:** Third-party API responses (Semantic Scholar, etc.) without type definitions

**Affected Files:**
- `src/app/api/admin/fetch-references/route.ts`
- `src/shared/utils/ai-response-parser.ts`

**Fix Strategy:** Create interface definitions for external API schemas

---

### 7. **React Ref Type Issues (TS2322)**
**Root Cause:** Incorrect ref callback signatures

**Affected Files:**
- `src/app/(admin)/admin/create-question/components/tag-autocomplete.tsx`

**Example:**
```typescript
ref={(el) => el} // ❌ Returns element instead of void
```

**Fix Strategy:** Use proper ref callback patterns or useRef hook

---

### 8. **Missing Dependencies/Imports (TS2304, TS2307)**
**Root Cause:** Missing function/variable declarations or module imports

**Examples:**
- `createClient` not imported in some API routes
- Missing type imports

**Fix Strategy:** Add missing imports and declarations

---

### 9. **Tag Type Conflicts (TS2719)**
**Root Cause:** Multiple `Tag` types defined in different locations causing conflicts

**Affected Files:**
- `src/app/(admin)/admin/create-question/components/step-metadata.tsx`

**Fix Strategy:** Consolidate tag types into single source of truth

---

### 10. **Tailwind Config Type (TS2322)**
**Root Cause:** `darkMode: ["class"]` should be `darkMode: "class"`

**File:** `tailwind.config.ts:5`

**Fix:** Change array to string literal

---

## Recommendations

### Immediate Fixes (High Priority)
1. **Fix Tailwind config** - 1 line change
2. **Admin panel property access** - Update 28 errors in admin components
3. **React Hook Form handlers** - Fix 4 occurrences in edit-question-client.tsx

### Short-term Improvements (Medium Priority)
4. **Add type definitions for common database queries** - Would fix ~200 errors
5. **Type public tool data structures** - Would fix ~170 errors in abpath and cell-quiz
6. **Add types for quiz system** - Would fix ~100 errors

### Long-term Type Safety (Low Priority)
7. **Add external API type definitions** - Semantic Scholar, AI responses
8. **Consolidate Tag types** - Single source of truth
9. **Type all service layer functions** - Add return types
10. **Enable stricter TypeScript settings** - Consider `strict: true`

---

## Notes

- Excluded directories: `dev/**`, `src/wip/**`
- Many errors are concentrated in specific files/features
- Core app functionality likely works despite type errors
- Type errors don't prevent runtime execution but reduce type safety
