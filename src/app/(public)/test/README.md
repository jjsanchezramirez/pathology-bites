# Test & Demo Pages Directory

This directory contains interactive test and demonstration pages for Pathology Bites features.

## Purpose

The `/test` route serves as a centralized hub for:
- **Component testing** - Test UI components in isolation
- **Feature demonstrations** - Showcase feature capabilities
- **Integration testing** - Test external API integrations
- **System validation** - Verify system behavior

## Structure

```
src/app/(public)/test/
├── page.tsx                    # Test hub index page
├── toast-demo/
│   └── page.tsx               # Toast notification system demo
├── diagnostic-search/
│   └── page.tsx               # Diagnostic search + NCI EVS tester
└── README.md                  # This file
```

## Current Test Pages

### `/test` - Test Hub
**Purpose:** Central index of all test/demo pages
**Features:**
- Browse all test pages by category
- Quick stats and navigation
- Links to documentation

### `/test/toast-demo` - Toast Notifications Demo
**Purpose:** Test and demonstrate the toast notification system
**Features:**
- All toast types (success, error, warning, info)
- Categorized toasts (auth, question, quiz, upload)
- Promise-based loading states
- Duplicate prevention demo
- Custom duration examples
- Interactive playground

**Documentation:**
- `docs/toast-system-architecture.md`
- `docs/toast-usage-guide.md`

### `/test/diagnostic-search` - Diagnostic Search & NCI EVS
**Purpose:** Test diagnostic search and NCI EVS API integration
**Features:**
- AI content parsing
- UMLS expansion
- NCI EVS terminology lookup
- Search term expansion

**Documentation:**
- `docs/nci-evs-tester-guide.md`
- `docs/UMLS_QUICK_REFERENCE.md`

## Adding New Test Pages

### 1. Create the Page

```bash
mkdir -p src/app/(public)/test/my-feature
```

Create `src/app/(public)/test/my-feature/page.tsx`:

```typescript
'use client'

export default function MyFeatureTestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1>My Feature Test</h1>
      {/* Your test UI here */}
    </div>
  )
}
```

### 2. Add to Index

Edit `src/app/(public)/test/page.tsx` and add to `testPages` array:

```typescript
{
  title: 'My Feature',
  description: 'Test my feature functionality',
  path: '/test/my-feature',
  category: 'Feature', // or 'Component', 'Integration', 'System'
  icon: <YourIcon className="h-5 w-5" />,
  status: 'stable' // or 'beta', 'experimental'
}
```

### 3. Document It

Add documentation to `docs/`:
- Architecture docs for complex features
- Usage guides for APIs
- Testing guides as needed

## Best Practices

### Test Page Design

1. **Clear Purpose** - Each test page should have a specific testing goal
2. **Interactive** - Provide controls to test different scenarios
3. **Visual Feedback** - Show results clearly
4. **Documentation Links** - Link to relevant docs
5. **Code Examples** - Include copy-able code snippets

### Categories

- **Component** - UI component testing (buttons, forms, etc.)
- **Feature** - Complete feature demonstrations (search, quiz, etc.)
- **Integration** - External API/service integration tests
- **System** - System-level behavior (auth, caching, etc.)

### Status Levels

- **stable** - Production-ready, fully tested
- **beta** - Functional but needs more testing
- **experimental** - Work in progress, may change

## Conventions

### Naming
- Use kebab-case for directories: `my-feature`
- Keep names short and descriptive
- Match feature/component name when possible

### Structure
```typescript
// Standard test page structure
export default function MyTestPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1>Test Page Title</h1>
        <p>Description</p>
      </div>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Section</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Interactive controls */}
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card className="mt-8 bg-muted">
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Links to docs */}
        </CardContent>
      </Card>
    </div>
  )
}
```

## vs Production Tools

**What's the difference between `/test` and `/tools`?**

| Aspect | `/test` | `/tools` |
|--------|---------|----------|
| **Purpose** | Testing & demonstration | Production features |
| **Audience** | Developers, QA | End users |
| **Stability** | Can be experimental | Must be stable |
| **UI Polish** | Functional, not polished | Polished, branded |
| **Documentation** | Technical, detailed | User-friendly |
| **Data** | Test/mock data ok | Real data only |

**Examples:**
- `/test/toast-demo` - Test toast system → Developer tool
- `/tools/cell-counter` - Cell counting → User-facing tool
- `/test/diagnostic-search` - Test search API → Developer tool
- `/tools/citations` - Citation generator → User-facing tool

## Access Control

Currently, all `/test` pages are public (accessible without authentication).

**Future considerations:**
- Restrict to authenticated users?
- Admin-only for sensitive tests?
- Toggle between test and production modes?

## Related Documentation

- [Main Docs Index](../../../docs/README.md)
- [Testing Strategy](../../../tests/README.md)
- [Toast Architecture](../../../docs/toast-system-architecture.md)

## Maintenance

### Regular Tasks

- [ ] Review test pages quarterly
- [ ] Update when features change
- [ ] Remove obsolete tests
- [ ] Keep documentation in sync
- [ ] Verify all links work

### Health Checklist

- [ ] All test pages load without errors
- [ ] Documentation links are valid
- [ ] Code examples are current
- [ ] Interactive features work
- [ ] Mobile responsive

---

**Last Updated:** December 18, 2025
**Maintainer:** Engineering Team
**Questions?** Check main docs or ask the team
