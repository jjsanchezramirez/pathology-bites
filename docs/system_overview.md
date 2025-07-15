# Pathology Bites - System Overview

## Project Summary

Pathology Bites is a modern pathology education platform designed for medical students, residents, and practitioners. The platform provides interactive quiz functionality, comprehensive question management, and a collaborative content creation workflow.

## Technology Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **UI**: React 19 with TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui component library
- **State Management**: React hooks + SWR for server state

### Backend
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with JWT tokens
- **Storage**: Supabase Storage for images
- **API**: Next.js API routes with Server Actions
- **Real-time**: Supabase subscriptions

### Infrastructure
- **Hosting**: Vercel (frontend)
- **Database**: Supabase cloud PostgreSQL
- **Storage**: Supabase Storage (500MB free tier)
- **CDN**: Vercel Edge Network

## Core Features

### Question Management System
- **Content Creation**: Rich question creation with image support
- **Review Workflow**: Draft → Under Review → Published
- **Version Control**: Semantic versioning for question updates
- **Content Organization**: Categories, tags, and question sets

### User Management
- **4-Role System**: Admin, Creator, Reviewer, User
- **Permission Control**: Role-based access control (RBAC)
- **Security**: Row-level security on all database operations
- **Audit Trail**: Complete action logging

### Quiz System
- **Interactive Quizzes**: Multiple quiz modes and configurations
- **Real-time Scoring**: Immediate feedback and progress tracking
- **Analytics**: Performance metrics and difficulty analysis
- **Question Selection**: Filtered and randomized question pools

### Content Review
- **Review Queue**: Centralized review interface
- **Quality Control**: Flag system for published content
- **Approval Workflow**: Accept, reject, or request changes
- **Feedback System**: Detailed review comments

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│   (Supabase)    │
│                 │    │                 │    │                 │
│ - React 19      │    │ - Server Actions│    │ - PostgreSQL    │
│ - TypeScript    │    │ - JWT Auth      │    │ - RLS Policies  │
│ - Tailwind CSS  │    │ - Rate Limiting │    │ - Functions     │
│ - shadcn/ui     │    │ - Validation    │    │ - Audit Logs    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Current Status

### Production Ready
- ✅ **Security**: 100% RLS coverage, all security issues resolved
- ✅ **Authentication**: JWT-based auth with device fingerprinting
- ✅ **Database**: 21 tables, 19 functions, 6 views fully implemented
- ✅ **Testing**: 95% test coverage with comprehensive security tests
- ✅ **Performance**: <2s page load times, optimized queries

### Database Statistics
- **Tables**: 21 with full RLS protection
- **Functions**: 19 secure functions
- **Views**: 6 security-invoker views
- **Policies**: 58 RLS policies
- **Indexes**: Strategic performance optimization

### Security Achievement
- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Role-based access control
- **Data Protection**: Row-level security on all tables
- **Audit Trail**: Complete activity logging
- **Function Security**: Search path injection protection

## User Roles

### Admin
- **System Access**: Full platform administration
- **User Management**: Create, modify, delete users
- **Content Control**: Direct question editing
- **Analytics**: Complete system analytics

### Creator
- **Content Creation**: Question creation and editing
- **Submission**: Submit questions for review
- **Asset Management**: Image upload and organization
- **Personal Analytics**: Own content performance

### Reviewer
- **Content Review**: Approve or reject submissions
- **Quality Control**: Manage flagged content
- **Analytics Access**: Review performance metrics
- **Feedback**: Provide detailed review comments

### User
- **Quiz Access**: Take quizzes with published questions
- **Performance**: Personal quiz analytics
- **Quality Feedback**: Flag problematic content
- **Profile**: Manage personal settings

## Key Workflows

### Question Creation
1. **Draft Creation**: Creator writes question with options
2. **Asset Association**: Add images, categories, tags
3. **Review Submission**: Submit for reviewer approval
4. **Review Process**: Reviewer approves or rejects
5. **Publication**: Approved questions go live

### Quiz Taking
1. **Quiz Configuration**: Select difficulty, categories, count
2. **Question Pool**: System selects questions randomly
3. **Interactive Quiz**: Answer questions with feedback
4. **Scoring**: Real-time progress and final results
5. **Analytics**: Performance tracking and history

### Content Review
1. **Review Queue**: Centralized pending submissions
2. **Quality Assessment**: Review question accuracy
3. **Decision Making**: Approve, reject, or request changes
4. **Feedback**: Provide detailed comments
5. **Publication**: Approved content goes live

## Performance Metrics

### Current Performance
- **Page Load**: <2 seconds
- **API Response**: <500ms
- **Database Query**: <100ms
- **Build Time**: <5 minutes
- **Test Execution**: <10 minutes

### Capacity (Supabase Free Tier)
- **Database**: 500MB storage
- **Questions**: 12,000-15,000 capacity
- **Users**: 2,500-3,000 active users
- **Images**: 400-488MB usage estimated

## Development Workflow

### Code Quality
- **TypeScript**: Strict type checking
- **Testing**: Jest + React Testing Library + Playwright
- **Linting**: ESLint + Prettier
- **Pre-commit**: Husky hooks for quality gates

### Git Workflow
- **Feature Branches**: `feature/feature-name`
- **Pull Requests**: Code review required
- **Automated Testing**: CI/CD pipeline
- **Deployment**: Automatic on merge to main

### Quality Gates
- **Build**: Must compile successfully
- **Tests**: 95% coverage requirement
- **Security**: All security tests passing
- **Performance**: Meet benchmark requirements

## Deployment Architecture

### Current Environment
- **Production**: Vercel + Supabase
- **Development**: Local + Supabase
- **Testing**: Automated CI/CD
- **Monitoring**: Built-in analytics

### Scaling Strategy
- **Horizontal**: Additional Vercel instances
- **Database**: Supabase plan upgrades
- **CDN**: Global content delivery
- **Caching**: Multi-layer caching strategy

## Security Overview

### Authentication
- **JWT Tokens**: Supabase Auth integration
- **Session Management**: Device fingerprinting
- **CSRF Protection**: Token-based validation
- **Rate Limiting**: Configurable per endpoint

### Authorization
- **Role-Based Access**: 4-role permission system
- **Row-Level Security**: 100% database coverage
- **Function Security**: Search path protection
- **Audit Logging**: Complete activity tracking

### Data Protection
- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Input Validation**: Zod schema validation
- **Output Sanitization**: XSS prevention
- **Database Security**: RLS policies and secure functions

## Documentation Structure

This documentation is organized into focused sections:

1. **[System Overview](system-overview.md)** - This document
2. **[Technical Architecture](technical-architecture.md)** - Database, API, security
3. **[Development Guide](development-guide.md)** - Setup, workflow, standards
4. **[User Guide](user-guide.md)** - Roles, permissions, features
5. **[API Reference](api-reference.md)** - Endpoints and usage
6. **[Security Guide](security-guide.md)** - Authentication, authorization
7. **[Testing Guide](testing-guide.md)** - Strategy and implementation
8. **[Deployment Guide](deployment-guide.md)** - Production deployment

## Next Steps

### Immediate Priorities
1. **User Testing**: Validate workflows with actual users
2. **Performance Optimization**: Implement caching strategies
3. **Content Creation**: Build question bank
4. **Mobile Optimization**: Responsive design improvements

### Future Roadmap
- **Advanced Analytics**: Machine learning insights
- **Mobile App**: Native mobile applications
- **API Ecosystem**: Third-party integrations
- **Enterprise Features**: Multi-institution support

---

*Last Updated: January 2025*