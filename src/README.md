# Source Code Directory

This directory contains the main application source code for Pathology Bites, organized using Next.js 15 App Router architecture.

## 📁 Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (admin)/           # Admin-only pages (role-protected)
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # User dashboard pages
│   ├── (public)/          # Public pages (no auth required)
│   ├── api/               # API route handlers

│   ├── layout.tsx         # Root layout component
│   ├── error.tsx          # Global error boundary
│   └── not-found.tsx      # 404 page
├── features/              # Feature-based modules
│   ├── admin/             # Admin management features
│   ├── auth/              # Authentication features
│   ├── cell-quiz/         # Cell identification quiz
│   ├── dashboard/         # Dashboard components
│   ├── images/            # Image management
│   ├── inquiries/         # Contact/inquiry system
│   ├── questions/         # Question management
│   ├── quiz/              # Quiz functionality
│   └── users/             # User management
├── shared/                # Shared utilities and components
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API and external services
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── data/                  # Static data files
├── styles/                # Global styles and CSS
├── __tests__/             # Test files
└── middleware.ts          # Next.js middleware
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
- **Jest** - Unit testing framework
- **Testing Library** - Component testing utilities
- **Playwright** - End-to-end testing

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
1. Create feature directory in `features/`
2. Implement components, hooks, and services
3. Add routes in appropriate `app/` subdirectory
4. Update shared types and utilities as needed
5. Add tests in `__tests__/`

### Code Organization
- **Single Responsibility**: Each module has a clear purpose
- **Dependency Direction**: Features depend on shared, not vice versa
- **Type Safety**: Comprehensive TypeScript coverage
- **Testing**: Unit and integration tests for critical paths

## 📋 Maintenance

### Code Quality
- ESLint configuration for consistent code style
- TypeScript strict mode for type safety
- Prettier for code formatting
- Husky for pre-commit hooks

### Performance
- Next.js optimizations (SSR, SSG, ISR)
- Image optimization and lazy loading
- Code splitting and dynamic imports
- Bundle analysis and optimization
