# Developer Setup Guide

Welcome to Pathology Bites! This guide will help you set up your development environment quickly and efficiently.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or later
- **npm** (comes with Node.js)
- **Git** for version control
- **Supabase account** (free tier available)

### Automated Setup

Run our setup script for the fastest way to get started:

```bash
# Clone the repository
git clone https://github.com/jjsanchezramirez/pathology-bites.git
cd pathology-bites

# Run the automated setup script
./scripts/setup-dev.sh
```

### Manual Setup

If you prefer to set up manually:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

3. **Edit `.env.local` with your Supabase credentials** (see below)

4. **Verify setup:**
   ```bash
   npm run type-check
   npm run test
   npm run build
   ```

## 🗄️ Database Setup

### 1. Create Supabase Project

1. Go to [Supabase](https://app.supabase.com)
2. Create a new project
3. Wait for the project to be ready (2-3 minutes)
4. Go to Settings > API to get your credentials

### 2. Configure Environment Variables

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. Database Setup

The Supabase database is already fully configured with all necessary tables and data. No additional setup required!

### 4. Verify Storage

1. Go to Storage in your Supabase dashboard
2. Verify the `images` bucket exists and is configured for public access
3. The storage system is already set up and working

## 🛠️ Development Workflow

### Available Scripts

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
npm run test:e2e:ui      # Run E2E tests with UI

# Utilities
npm run clean            # Clean build artifacts
npm run cleanup          # Clean dependencies and fix issues
```

### Development Server

Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
pathology-bites/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (admin)/        # Admin routes
│   │   ├── (auth)/         # Authentication routes
│   │   ├── (dashboard)/    # User dashboard routes
│   │   ├── (public)/       # Public pages
│   │   └── api/            # API routes
│   ├── features/           # Feature-based modules
│   │   ├── auth/           # Authentication
│   │   ├── questions/      # Question management
│   │   ├── images/         # Image management
│   │   ├── users/          # User management
│   │   └── quiz/           # Quiz system
│   ├── shared/             # Shared components and utilities
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   └── styles/             # Global styles
├── public/                 # Static assets
├── scripts/                # Development scripts
└── docs/                   # Documentation
```

## 🧪 Testing

### Unit Tests

Run unit tests with Jest and Testing Library:

```bash
npm run test
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

### E2E Tests

Run end-to-end tests with Playwright:

```bash
npm run test:e2e
npm run test:e2e:ui   # With UI
```

## 🔧 Troubleshooting

### Common Issues

**Build Errors:**
```bash
npm run clean
rm -rf node_modules package-lock.json
npm install
```

**TypeScript Errors:**
```bash
npm run type-check
```

**Database Connection Issues:**
- Verify Supabase environment variables
- Check Supabase project status
- Ensure RLS policies are configured

### Getting Help

1. Check the [README.md](README.md) for general information
2. Review the [troubleshooting section](README.md#troubleshooting)
3. Check existing [GitHub issues](https://github.com/jjsanchezramirez/pathology-bites/issues)
4. Create a new issue if needed

## 🎯 Next Steps

Once your environment is set up:

1. **Explore the codebase** - Start with `src/app` for routing
2. **Run the application** - `npm run dev` and visit localhost:3000
3. **Create a test user** - Sign up through the application
4. **Explore admin features** - Set your user role to 'admin' in the database
5. **Start developing** - Pick a feature and start coding!

Happy coding! 🚀
