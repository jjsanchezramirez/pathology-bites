# Pathology Bites Documentation

Welcome to the Pathology Bites documentation! This directory contains comprehensive documentation for developers, users, and project stakeholders.

## 📁 Documentation Structure

### 🛠️ Development
- **[Developer Setup Guide](development/DEVELOPER_SETUP.md)** - Complete guide for setting up your development environment
- **[Security Guide](development/SECURITY_GUIDE.md)** - Security measures, environment validation, and rate limiting
- **[Database Performance Guide](development/DATABASE_PERFORMANCE.md)** - Database optimization, indexes, and monitoring
- **[Testing Guide](#testing)** - Information about Jest (unit tests) and Playwright (E2E tests)

### 🎯 Project Management
- **[Project Roadmap](project/PATHOLOGY_BITES_ROADMAP.md)** - 30-day implementation plan and current progress
- **[Architecture Overview](#architecture)** - System design and technical decisions

### ✨ Features
- **[Question Review Workflow](features/QUESTION_REVIEW_WORKFLOW.md)** - How the question approval process works
- **[JSON Import Feature](features/question-json-import.md)** - Bulk question import documentation
- **[API Documentation](features/api-documentation.md)** - Complete API reference with examples
- **[Sample Import Data](features/)** - Example JSON files for testing imports

## 🧪 Testing

This project uses two main testing frameworks:

### Jest (Unit & Integration Tests)
**Location**: Tests alongside source code (`*.test.ts`, `*.spec.ts`)
**Purpose**: Unit tests, component tests, API route tests
**Run with**: `npm run test`

Jest tests verify individual components and functions work correctly in isolation.

### Playwright (End-to-End Tests)
**Location**: `e2e/` folder (`*.spec.ts`)
**Purpose**: Full browser automation testing user workflows
**Run with**: `npm run test:e2e`

Playwright tests simulate real user interactions across the entire application.

#### Current E2E Tests
- **`e2e/auth.spec.ts`** - Authentication flow testing (login, signup, logout)

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Testing**: Jest + Testing Library, Playwright
- **Deployment**: Vercel

### Key Design Patterns
- **Feature-based architecture** - Code organized by business features
- **Server-side rendering** - Next.js App Router with RSC
- **Type safety** - Full TypeScript coverage
- **Component composition** - Reusable UI components with shadcn/ui

## 📚 Quick Links

- **[Main README](../README.md)** - Project overview and quick start
- **[Developer Setup](development/DEVELOPER_SETUP.md)** - Get started developing
- **[Project Roadmap](project/PATHOLOGY_BITES_ROADMAP.md)** - Current progress and next steps
- **[Question Import](features/question-json-import.md)** - Bulk import questions

## 🤝 Contributing

1. Read the [Developer Setup Guide](development/DEVELOPER_SETUP.md)
2. Check the [Project Roadmap](project/PATHOLOGY_BITES_ROADMAP.md) for current priorities
3. Follow the testing guidelines (Jest for units, Playwright for E2E)
4. Update documentation when adding new features

---

For questions or issues, please check the main [README](../README.md) or create an issue on GitHub.
