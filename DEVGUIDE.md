# Pathology Bites Developer Guide

This guide provides comprehensive information for developers working on the Pathology Bites project. It covers the application architecture, database schema, development workflow, and best practices to ensure consistent, high-quality code.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Application Architecture](#application-architecture)
4. [Database Schema](#database-schema)
5. [Development Environment Setup](#development-environment-setup)
6. [Development Workflow](#development-workflow)
7. [Component Guidelines](#component-guidelines)
8. [State Management](#state-management)
9. [API Integration](#api-integration)
10. [Testing Strategy](#testing-strategy)
11. [Performance Optimization](#performance-optimization)
12. [Deployment Process](#deployment-process)
13. [Troubleshooting](#troubleshooting)

## Project Overview

Pathology Bites is an open educational resource providing interactive pathology learning materials for medical students, residents, and practicing pathologists. The platform features a comprehensive question bank with detailed explanations, high-quality pathology images, and performance tracking.

### Key Features

- **Question Bank**: Interactive practice questions across all major pathology subspecialties
- **User Dashboard**: Performance tracking and analytics
- **Admin Portal**: Content management and user administration
- **Image Library**: Management of pathology images used in questions
- **Quiz System**: Different learning modes with performance tracking

## Technology Stack

### Frontend
- [Next.js](https://nextjs.org/) (v14.0.0) with App Router
- [TypeScript](https://www.typescriptlang.org/) (v5.0.4)
- [Tailwind CSS](https://tailwindcss.com/) (v4.0)
- [shadcn/ui](https://ui.shadcn.com/) for UI components
- [React Hook Form](https://react-hook-form.com/) with [Zod](https://github.com/colinhacks/zod) for form validation

### Backend
- [Supabase](https://supabase.io/) for authentication, database, and storage
- PostgreSQL database
- Row-Level Security (RLS) policies

### Infrastructure
- [Vercel](https://vercel.com/) for deployment and hosting
- [GitHub](https://github.com/) for version control

## Application Architecture

The application follows a modular structure organized by feature and responsibility.

### Directory Structure

```
src/
├── app/                # Next.js App Router routes
│   ├── (admin)/       # Admin section routes
│   ├── (auth)/        # Authentication routes
│   ├── (dashboard)/   # User dashboard routes
│   ├── (public)/      # Public-facing routes
│   ├── api/           # API endpoints
├── components/        # React components
│   ├── admin/         # Admin interface components
│   ├── auth/          # Authentication components
│   ├── dashboard/     # Dashboard components
│   ├── images/        # Image-related components
│   ├── landing/       # Landing page components
│   ├── layout/        # Layout components
│   ├── questions/     # Question-related components
│   ├── ui/            # Base UI components (shadcn/ui)
├── hooks/             # Custom React hooks
├── lib/               # Utility functions
│   ├── auth/          # Authentication utilities
│   ├── images/        # Image processing utilities
│   ├── network/       # Network status utilities
│   ├── supabase/      # Supabase client utilities
├── styles/            # Global CSS
├── types/             # TypeScript type definitions
```

### Routing Structure

- **Public Routes** (`/src/app/(public)/`): Marketing pages accessible to all users
- **Auth Routes** (`/src/app/(auth)/`): Authentication flow pages
- **Dashboard Routes** (`/src/app/(dashboard)/`): User-facing features, requiring authentication
- **Admin Routes** (`/src/app/(admin)/`): Admin-only pages, requiring admin role
- **API Routes** (`/src/app/api/`): Backend endpoints for data operations

### Key Services

- **Authentication**: Managed through Supabase Auth
- **Database Access**: Supabase PostgreSQL client
- **Image Storage**: Supabase Storage with client-side compression
- **Network Status**: Custom monitoring for offline/online transitions

## Database Schema

The database schema is designed to support the core features of the application, including questions, categories, user responses, and analytics.

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Institutions Table
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    middle_initial CHAR(1),
    last_name VARCHAR(100),
    institution_id UUID REFERENCES institutions(id),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'admin')),
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('student', 'resident', 'fellow', 'attending', 'other')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tags Table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Questions Table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    stem TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    teaching_point TEXT NOT NULL,
    question_references TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Answer Options Table
CREATE TABLE answer_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    explanation TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Images Table
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('gross', 'microscopic', 'diagram')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Question Images Junction Table
CREATE TABLE question_images (
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    question_section VARCHAR(20) NOT NULL CHECK (question_section IN ('stem', 'explanation')),
    order_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (question_id, image_id, question_section)
);

-- Question Categories Junction Table
CREATE TABLE question_categories (
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, category_id)
);

-- Question Tags Junction Table
CREATE TABLE question_tags (
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);

-- Quiz Sessions Table
CREATE TABLE quiz_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    quiz_mode VARCHAR(20) NOT NULL CHECK (quiz_mode IN ('test', 'tutor', 'study')),
    status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Responses Table
CREATE TABLE user_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    selected_option_id UUID NOT NULL REFERENCES answer_options(id),
    is_correct BOOLEAN NOT NULL,
    time_spent INTEGER NOT NULL, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Analytics Table
CREATE TABLE performance_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    category_id UUID REFERENCES categories(id),
    total_questions INTEGER NOT NULL DEFAULT 0,
    questions_answered INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    average_time INTEGER NOT NULL DEFAULT 0, -- in seconds
    peer_rank DECIMAL(5,2),
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Entity Relationships

- **Users** belong to **Institutions** (optional)
- **Questions** have multiple **Answer Options**
- **Questions** can be associated with multiple **Categories** and **Tags**
- **Questions** can have multiple **Images** in different sections
- **Quiz Sessions** track a user's interaction with questions
- **User Responses** record answers to questions in quiz sessions
- **Performance Analytics** aggregate user performance by category

## Development Environment Setup

### Prerequisites

- Node.js 18.0.0 or later
- npm or yarn
- Git

### Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/pathology-bites/pathology-bites.git
   cd pathology-bites
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Configure environment variables:
   - Copy the `.env.example` file to `.env.local`
   - Update with your Supabase credentials and other required values

### Supabase Setup

1. Create a new Supabase project
2. Run the SQL scripts in the `database` directory to set up the schema
3. Configure Row-Level Security (RLS) policies
4. Set up Storage buckets for image uploads

### Running the Application

Start the development server:
```bash
npm run dev
# or
yarn dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Development Workflow

### Feature Development Process

1. **Branch Creation**:
   - Create a feature branch from `main`
   - Use the naming convention: `feature/feature-name`

2. **Implementation**:
   - Develop the feature with appropriate tests
   - Follow the coding guidelines and component structure

3. **Testing**:
   - Run unit tests: `npm run test`
   - Ensure all tests pass and coverage is adequate

4. **Code Review**:
   - Create a Pull Request to `main`
   - Address reviewer feedback
   - Ensure CI checks pass

5. **Merge**:
   - Merge the PR once approved
   - Delete the feature branch

### Bug Fix Process

1. Create a branch with the prefix `fix/`: `fix/issue-description`
2. Implement the fix with appropriate tests
3. Follow the same review and merge process as feature development

## Component Guidelines

### Component Structure

Components should follow this general structure:

```tsx
// src/components/feature/component-name.tsx
'use client' // Add if using client-side features

import { useState } from 'react'
import { useCustomHook } from '@/hooks/use-custom-hook'
import { ChildComponent } from './child-component'
import { SomeUtil } from '@/lib/some-util'

interface ComponentProps {
  prop1: string
  prop2?: number
}

export function ComponentName({ prop1, prop2 = 0 }: ComponentProps) {
  const [state, setState] = useState(initialState)
  const { data, loading } = useCustomHook()

  // Event handlers
  const handleEvent = () => {
    // Implementation
  }

  // Conditional rendering
  if (loading) {
    return <LoadingState />
  }

  // Main render
  return (
    <div className="class-name">
      <ChildComponent prop={prop1} />
    </div>
  )
}
```

### UI Component Best Practices

1. **Single Responsibility**: Components should have a single responsibility
2. **Prop Typing**: Always define TypeScript interfaces for props
3. **Default Props**: Provide sensible defaults for optional props
4. **Error States**: Handle error states gracefully
5. **Loading States**: Provide visual feedback during loading
6. **Accessibility**: Ensure components are accessible (ARIA attributes, keyboard navigation)

## State Management

### Local State

Use React's `useState` and `useReducer` hooks for component-local state.

```tsx
const [isOpen, setIsOpen] = useState(false)
```

### Shared State

For state shared between components, use custom hooks:

```tsx
// src/hooks/use-auth.ts
export function useAuth() {
  // Implementation
  return { user, login, logout, isLoading }
}
```

### Server State

For data fetching and caching, consider SWR or React Query.

```tsx
import useSWR from 'swr'

function useQuestions() {
  const { data, error, mutate } = useSWR('/api/questions', fetcher)
  return { questions: data, isLoading: !error && !data, isError: error, mutate }
}
```

## API Integration

### API Route Pattern

API routes should follow this pattern:

```tsx
// src/app/api/resource/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  // Define validation schema
})

export async function GET(request: Request) {
  try {
    // Implementation
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error message' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const validated = schema.parse(json)
    // Implementation
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error message' },
      { status: 400 }
    )
  }
}
```

### Error Handling

- Use consistent error response format
- Include appropriate HTTP status codes
- Provide meaningful error messages
- Log errors server-side

## Testing Strategy

### Testing Tools

- [Jest](https://jestjs.io/) for unit and integration tests
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for component tests
- [Cypress](https://www.cypress.io/) for end-to-end tests

### Test Types

1. **Unit Tests**: Test individual functions and utilities
2. **Component Tests**: Test React components in isolation
3. **Integration Tests**: Test interactions between components
4. **API Tests**: Test API routes
5. **End-to-End Tests**: Test complete user flows

### Testing Guidelines

- Write tests during feature development
- Aim for high test coverage for critical code paths
- Focus on testing behavior, not implementation details
- Use meaningful test descriptions

## Performance Optimization

### Code Splitting

Use Next.js dynamic imports for code splitting:

```tsx
import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(() => import('./component'))
```

### Image Optimization

- Use Next.js Image component for optimized images
- Implement client-side compression for uploads
- Use appropriate image formats (WebP where supported)

### Caching Strategy

- Implement SWR or React Query for data caching
- Use appropriate cache headers for API responses
- Consider implementing a service worker for offline support

## Deployment Process

### Staging Deployment

1. Merge to the `staging` branch
2. Automatic deployment to the staging environment
3. Conduct QA testing

### Production Deployment

1. Create a release branch: `release/vX.Y.Z`
2. Merge to `main` after final review
3. Tag the release: `vX.Y.Z`
4. Automatic deployment to production

### Post-Deployment Verification

- Smoke test critical paths
- Monitor error rates
- Check performance metrics

## Troubleshooting

### Common Issues

1. **Authentication Issues**:
   - Check Supabase configuration
   - Verify environment variables
   - Check browser console for errors

2. **API Errors**:
   - Check network requests in browser developer tools
   - Verify request payloads match expected schema
   - Look for database migration issues

3. **Build Failures**:
   - Check TypeScript errors
   - Verify all dependencies are installed
   - Check for circular dependencies

### Debugging Tools

- Browser DevTools for frontend issues
- Supabase Dashboard for database queries
- Vercel logs for deployment issues

## Appendix

### Useful Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

### Glossary

- **App Router**: Next.js routing system using directory-based routing
- **RLS**: Row Level Security, Supabase's permission system
- **Middleware**: Next.js middleware for request processing
- **RSC**: React Server Components for server-side rendering

---

This developer guide is a living document. If you find any issues or have suggestions for improvements, please create an issue or pull request.