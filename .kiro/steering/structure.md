# Project Structure & Architecture

## Root Directory Organization
```
pathology-bites/
├── src/                    # Application source code
├── public/                 # Static assets (images, icons, logos)
├── docs/                   # Comprehensive documentation
├── tools/                  # Utility scripts and development tools
├── tests/                  # End-to-end and integration tests
└── .kiro/                  # Kiro AI assistant configuration
```

## Source Code Architecture (`src/`)

### App Router Structure (`src/app/`)
- **Route Groups**: Organized by user access level
  - `(admin)/` - Admin-only pages (role-protected)
  - `(auth)/` - Authentication pages (login, signup, reset)
  - `(dashboard)/` - User dashboard pages (quiz, progress)
  - `(public)/` - Public pages (landing, about)
- **API Routes**: `api/` contains RESTful endpoints
- **Special Files**: `layout.tsx`, `error.tsx`, `not-found.tsx`

### Feature-Based Organization (`src/features/`)
Each feature is self-contained with:
```
features/[feature-name]/
├── components/          # Feature-specific UI components
├── hooks/              # Custom React hooks
├── services/           # API calls and business logic
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── index.ts            # Barrel exports
```

**Core Features**:
- `admin/` - Admin management and content moderation
- `auth/` - Authentication and user management
- `questions/` - Question creation, editing, and review workflow
- `quiz/` - Quiz functionality and modes
- `images/` - Image management and viewer
- `dashboard/` - User analytics and progress tracking

### Shared Resources (`src/shared/`)
- `components/` - Reusable UI components (shadcn/ui)
- `hooks/` - Shared custom React hooks
- `services/` - Common services (Supabase client, etc.)
- `types/` - Shared TypeScript interfaces
- `utils/` - Utility functions and helpers

## Key Architecture Patterns

### Component Hierarchy
1. **Page Components** - Route-level components in `app/`
2. **Feature Components** - Business logic components in `features/`
3. **Shared Components** - Reusable UI in `shared/components/`
4. **Base Components** - shadcn/ui primitives in `shared/components/ui/`

### Data Flow
- **Server Actions** - Form submissions and mutations
- **API Routes** - RESTful endpoints for complex operations
- **Supabase Client** - Direct database queries with RLS
- **Real-time Subscriptions** - Live data updates

### File Naming Conventions
- **Components**: PascalCase (e.g., `QuestionForm.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useQuizState.ts`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Types**: PascalCase interfaces (e.g., `Question`, `QuizConfig`)

## Import Patterns
- Use `@/` alias for src imports: `import { Button } from '@/shared/components/ui/button'`
- Barrel exports from feature index files
- Shared types exported from `@/shared/types`

## Testing Structure
- **Unit Tests**: Co-located with components in `__tests__/` folders
- **Integration Tests**: Feature-level testing
- **E2E Tests**: Full user workflows in `tests/` directory

## Data & Assets
- **Static Data**: JSON files in `src/data/`
- **Images**: Organized by type in `public/images/`
- **Cell Images**: Extensive collection in `public/images/cells/`
- **Logos**: Partner logos in `public/logos/`