# Development Guide

## Quick Start

### Prerequisites
- **Node.js** 18.0.0 or later
- **npm** (comes with Node.js)
- **Git** for version control
- **Supabase account** (free tier available)

### Setup Commands
```bash
# Clone repository
git clone https://github.com/your-org/pathology-bites.git
cd pathology-bites

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Verify setup
npm run type-check
npm run test
npm run build

# Start development
npm run dev
```

## Environment Configuration

### Required Variables
```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application Settings
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
```

### Optional Variables
```bash
# Authentication & Security
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
AUTH_RATE_LIMIT_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_MINUTES=15

# External Services
RESEND_API_KEY=your-resend-api-key
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id

# Development
DEBUG=false
```

## Database Setup

### Supabase Project Setup
1. Create new project at [supabase.com](https://supabase.com)
2. Wait for project initialization (2-3 minutes)
3. Get credentials from Settings → API
4. Update `.env.local` with your credentials

### Database Schema
The database is **pre-configured** with:
- ✅ All 21 tables with proper relationships
- ✅ Row Level Security (RLS) policies
- ✅ Database functions and views
- ✅ Sample data for testing
- ✅ Proper indexes for performance

**No manual database setup required** - everything is ready to use.

## Development Scripts

### Essential Commands
```bash
# Development
npm run dev              # Start development server
npm run dev:turbo        # Start with Turbo (faster)

# Building
npm run build            # Production build
npm run start            # Start production server

# Code Quality
npm run lint             # Check for linting errors
npm run lint:fix         # Auto-fix linting issues
npm run type-check       # TypeScript type checking

# Testing
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run E2E tests

# Utilities
npm run clean            # Clean build artifacts
npm run cleanup          # Clean dependencies and fix issues
```

## Code Standards

### TypeScript Configuration
```typescript
// tsconfig.json highlights
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}

// Component example
interface ComponentProps {
  title: string
  description?: string
  onAction: (id: string) => void
}

export function Component({ title, description, onAction }: ComponentProps) {
  return (
    <div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      <button onClick={() => onAction('123')}>Action</button>
    </div>
  )
}
```

### Code Organization
```typescript
// File structure example
// src/features/feature-name/components/component-name.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useFeature } from '../hooks/use-feature'

interface ComponentProps {
  // Props definition
}

export function ComponentName({ ...props }: ComponentProps) {
  // Component implementation
  const { data, loading, error } = useFeature()
  
  return (
    <div>
      {/* Component JSX */}
    </div>
  )
}

export default ComponentName
```

### Naming Conventions
- **Files**: kebab-case (e.g., `question-card.tsx`)
- **Components**: PascalCase (e.g., `QuestionCard`)
- **Variables**: camelCase (e.g., `questionData`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS`)
- **Types**: PascalCase (e.g., `UserRole`)

## Feature Development

### Feature Structure
```
features/feature-name/
├── components/            # Feature components
│   ├── component-name.tsx
│   └── __tests__/         # Component tests
├── hooks/                 # Feature hooks
│   ├── use-feature.ts
│   └── __tests__/         # Hook tests
├── services/              # Feature services
│   ├── feature-service.ts
│   └── __tests__/         # Service tests
├── types/                 # Feature types
│   └── feature-types.ts
└── utils/                 # Feature utilities
```

### Component Development
```typescript
// Component file structure
// src/features/feature/components/component-name.tsx

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'

interface ComponentProps {
  id: string
  title: string
  onUpdate?: (data: any) => void
}

export function ComponentName({ id, title, onUpdate }: ComponentProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const { user } = useAuth()

  useEffect(() => {
    // Effect logic
  }, [id])

  const handleAction = async () => {
    setLoading(true)
    try {
      // Action logic
      onUpdate?.(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>{title}</h2>
      <Button onClick={handleAction} disabled={loading}>
        {loading ? 'Loading...' : 'Action'}
      </Button>
    </div>
  )
}
```

### API Development
```typescript
// API route structure
// src/app/api/endpoint/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'

// Input validation schema
const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate input
    const body = await request.json()
    const validatedData = CreateSchema.parse(body)

    // Authentication check
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Database operation
    const { data, error } = await supabase
      .from('table_name')
      .insert(validatedData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

## Testing Strategy

### Unit Testing
```typescript
// Component test example
// src/features/feature/components/__tests__/component-name.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ComponentName } from '../component-name'
import { useAuth } from '@/features/auth/hooks/use-auth'

// Mock dependencies
jest.mock('@/features/auth/hooks/use-auth')

describe('ComponentName', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: '123', role: 'user' }
    })
  })

  it('renders correctly', () => {
    render(<ComponentName id="123" title="Test Title" />)
    
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('handles actions correctly', async () => {
    const onUpdate = jest.fn()
    render(<ComponentName id="123" title="Test" onUpdate={onUpdate} />)
    
    fireEvent.click(screen.getByRole('button'))
    
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled()
    })
  })
})
```

### API Testing
```typescript
// API test example
// src/app/api/endpoint/__tests__/route.test.ts

import { POST } from '../route'
import { NextRequest } from 'next/server'

describe('/api/endpoint', () => {
  it('creates resource successfully', async () => {
    const request = new NextRequest('http://localhost/api/endpoint', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Title' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveProperty('id')
  })

  it('validates input correctly', async () => {
    const request = new NextRequest('http://localhost/api/endpoint', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid input')
  })
})
```

## Git Workflow

### Branch Strategy
```bash
# Feature development
git checkout -b feature/feature-name
git commit -m "feat: add new feature"
git push origin feature/feature-name

# Bug fixes
git checkout -b fix/bug-description
git commit -m "fix: resolve issue with X"
git push origin fix/bug-description

# Documentation
git checkout -b docs/update-readme
git commit -m "docs: update setup instructions"
git push origin docs/update-readme
```

### Commit Messages
```
type(scope): description

- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Code style
- refactor: Code refactoring
- test: Testing
- chore: Maintenance

Examples:
feat(auth): add password reset functionality
fix(quiz): resolve scoring calculation bug
docs(api): update endpoint documentation
```

### Pull Request Process
1. **Create Feature Branch**: `git checkout -b feature/your-feature`
2. **Develop & Test**: Follow TDD practices
3. **Quality Checks**: `npm run lint && npm run test && npm run build`
4. **Create PR**: Submit for review
5. **Code Review**: Address feedback
6. **Merge**: After approval and CI passes

## Performance Guidelines

### Frontend Performance
```typescript
// Optimize component rendering
import { memo, useMemo, useCallback } from 'react'

const OptimizedComponent = memo(({ data, onAction }) => {
  // Memoize expensive calculations
  const processedData = useMemo(() => {
    return data.map(item => ({ ...item, processed: true }))
  }, [data])

  // Memoize callbacks to prevent re-renders
  const handleAction = useCallback((id: string) => {
    onAction(id)
  }, [onAction])

  return (
    <div>
      {processedData.map(item => (
        <div key={item.id} onClick={() => handleAction(item.id)}>
          {item.name}
        </div>
      ))}
    </div>
  )
})
```

### Database Performance
```typescript
// Efficient database queries
const fetchQuestions = async (filters: QuestionFilters) => {
  const query = supabase
    .from('questions')
    .select(`
      id,
      title,
      difficulty,
      category:categories(name),
      options:question_options(id, text, is_correct)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1)

  // Add conditional filters
  if (filters.difficulty) {
    query.eq('difficulty', filters.difficulty)
  }
  
  if (filters.category) {
    query.eq('category_id', filters.category)
  }

  const { data, error } = await query
  
  if (error) throw error
  return data
}
```

## Debugging

### Development Tools
```bash
# Debug with inspect
npm run dev -- --inspect

# Debug tests
npm run test -- --debug

# Debug specific component
npm run test -- --testNamePattern="ComponentName"

# Clear cache
npm run test -- --clearCache
```

### Common Issues
1. **Build Errors**: Run `npm run clean` and `npm install`
2. **Type Errors**: Check `npm run type-check`
3. **Database Issues**: Verify Supabase connection
4. **Authentication Issues**: Check environment variables

### Debugging Techniques
```typescript
// Use console.log strategically
console.log('Debug point:', { variable, state })

// Use debugger statement
debugger;

// Use React Developer Tools
// Install browser extension for component inspection

// Use network tab for API debugging
// Check request/response in browser dev tools
```

## Deployment

### Pre-deployment Checklist
- [ ] All tests passing (`npm run test`)
- [ ] TypeScript compilation successful (`npm run type-check`)
- [ ] Build process successful (`npm run build`)
- [ ] Environment variables configured
- [ ] Database migrations applied

### Deployment Process
1. **Push to main branch**
2. **Vercel auto-deploys**
3. **Verify deployment**
4. **Monitor for issues**
5. **Update documentation**

## Security Guidelines

### Authentication
```typescript
// Always validate user sessions
const { user } = useAuth()

if (!user) {
  return <div>Please log in</div>
}

// Check permissions
const canPerformAction = hasPermission(user.role, 'action_name')

if (!canPerformAction) {
  return <div>Insufficient permissions</div>
}
```

### API Security
```typescript
// Always validate inputs
const schema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1)
})

const validatedData = schema.parse(requestBody)

// Always authenticate
const user = await getUser(request)
if (!user) {
  return new Response('Unauthorized', { status: 401 })
}

// Always authorize
const hasPermission = await checkPermission(user.role, 'create_question')
if (!hasPermission) {
  return new Response('Forbidden', { status: 403 })
}
```

## Troubleshooting

### Common Solutions
1. **Clear node_modules**: `rm -rf node_modules && npm install`
2. **Clear Next.js cache**: `rm -rf .next && npm run build`
3. **Reset database**: Check Supabase dashboard
4. **Check logs**: Use browser dev tools and terminal

### Getting Help
1. Check existing documentation
2. Review GitHub issues
3. Check Supabase documentation
4. Create new issue with details

---

*Last Updated: January 2025*