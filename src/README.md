# Source Code Directory

This directory contains the main application source code for Pathology Bites, organized using Next.js 15 App Router architecture.

## 📁 Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (admin)/           # Admin panel (role-protected)
│   ├── (auth)/            # Login / signup / password reset
│   ├── (dashboard)/       # Authenticated user dashboard
│   ├── (public)/          # Public marketing pages
│   ├── api/               # API route handlers
│   ├── debug/             # Dev-only test pages (gitignored)
│   ├── docs/              # Embedded docs routes
│   ├── layout.tsx         # Root layout
│   ├── error.tsx          # Global error boundary
│   ├── not-found.tsx      # 404 page
│   ├── robots.ts          # robots.txt generator
│   └── sitemap.ts         # sitemap.xml generator
├── features/              # Domain modules
│   ├── admin/             # Admin tooling (users, content moderation)
│   ├── auth/              # Authentication flows and session hooks
│   ├── public/            # Public-facing tools (cell quiz, virtual slides, etc.)
│   └── user/              # Signed-in user features (quiz, dashboard, achievements)
├── shared/                # Reusable utilities and components
│   ├── components/        # UI components (shadcn/ui lives here)
│   ├── config/            # Runtime config
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Supabase clients and external service wrappers
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Utility functions
├── styles/                # Global styles and CSS
└── middleware.ts          # Next.js middleware (auth/role gating)
```

## 🏗️ Architecture Patterns

### App Router Structure

- **Route Groups**: `(admin)`, `(auth)`, `(dashboard)`, `(public)` for logical organization
- **Role-based Access**: Different route groups for different user roles
- **API Routes**: RESTful API endpoints in `app/api/`

### Feature-based Organization

- **Self-contained Features**: Each feature contains its own components, hooks, and logic
- **Shared Resources**: Common utilities in `shared/` directory
- **Clear Boundaries**: Features communicate through well-defined interfaces

### Component Architecture

- **Reusable Components**: Shared UI components in `shared/components/`
- **Feature Components**: Feature-specific components within feature directories
- **Composition**: Components built using composition patterns

## 🔧 Technology Stack

### Frontend

- **Next.js 15** - React framework with App Router
- **React 19** - UI library with latest features
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first styling

### Backend Integration

- **Supabase** - Database, authentication, and storage
- **API Routes** - Server-side logic and data processing
- **Middleware** - Request processing and authentication

### Testing

- **Vitest** - Unit testing framework
- **Testing Library** - Component testing utilities

## 🎯 Key Features

### Authentication & Authorization

- 4-role system (Admin, Creator, Reviewer, User)
- Row Level Security (RLS) integration
- Protected routes and components

### Question Management

- Question creation and editing
- Review workflow system
- Version control and approval process

### Educational Tools

- Interactive quizzes
- Cell identification tools
- Image galleries and references

### Admin Features

- User management
- Content moderation
- System monitoring

## 🔄 Development Workflow

### Adding New Features

1. Create feature directory under `features/{admin|auth|public|user}/`
2. Implement components, hooks, and services
3. Add routes in the appropriate `app/` subdirectory
4. Update shared types and utilities as needed
5. Co-locate tests next to the code being tested

### Code Organization

- **Single Responsibility**: Each module has a clear purpose
- **Dependency Direction**: Features depend on shared, not vice versa
- **Type Safety**: Comprehensive TypeScript coverage
- **Testing**: Unit and integration tests for critical paths

## 📋 Maintenance

### Code Quality

- ESLint configuration for consistent code style
- TypeScript strict mode for type safety
- Prettier for code formatting (enforced via the `prettier/prettier` ESLint rule)

### Performance

- Next.js optimizations (SSR, SSG, ISR)
- Image optimization and lazy loading
- Code splitting and dynamic imports
- Bundle analysis and optimization
