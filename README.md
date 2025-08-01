# Pathology Bites

![Pathology Bites](https://github.com/jjsanchezramirez/pathology-bites/raw/main/public/images/logo.png)

Pathology Bites is a modern, AI-powered educational platform providing free, high-quality pathology learning materials for medical students, residents, and practicing pathologists. Our comprehensive question bank and interactive quiz system offer practice across all major pathology subspecialties with detailed explanations and performance tracking.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3.2-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61DAFB)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1.7-38B2AC)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.49.4-3ECF8E)](https://supabase.io/)

## 📊 Current Status

**🚀 Week 2 Development - Major Improvements Completed**

✅ **Security & Performance Enhancements**
- Environment variable validation with comprehensive error handling
- API rate limiting for all critical endpoints (auth, admin, quiz)
- Database performance optimization with strategic indexes
- Full-text search implementation with GIN indexes
- Materialized views for dashboard statistics

✅ **Critical Bug Fixes**
- Edit question dialog now fully functional
- Tailwind CSS styling configuration resolved
- All TODO items in codebase completed

✅ **Coming Soon Page Enhancements**
- Real-time database statistics display (questions, images, categories)
- Improved visual design with gradient backgrounds and enhanced cards
- Fixed scroll behavior for better user experience
- Public stats API endpoint with fallback values
- Loading states and graceful error handling

✅ **Comprehensive Documentation**
- [Security Guide](docs/development/SECURITY_GUIDE.md) - Environment validation, rate limiting, best practices
- [Database Performance Guide](docs/development/DATABASE_PERFORMANCE.md) - Indexes, optimization, monitoring
- [API Documentation](docs/features/api-documentation.md) - Complete API reference with examples
- [Database Schema](docs/features/DATABASE_SCHEMA.md) - Complete schema documentation with analytics
- [Storage Capacity Analysis](docs/technical/STORAGE_CAPACITY_ANALYSIS.md) - Capacity planning and optimization

**📈 Quality Metrics**
- Build: ✅ Successful production build
- Tests: 93.6% pass rate (73/78 tests passing)
- TypeScript: ✅ Strict compilation without errors
- Security: ✅ No hardcoded secrets, proper validation

**📊 Platform Capacity (Supabase Free Tier)**
- **Questions**: 12,000-15,000 high-quality questions
- **Active Users**: 2,500-3,000 concurrent users
- **Quiz Attempts**: 50,000+ total attempts
- **Storage**: Optimized for 500MB database limit

## 🔍 Features

### Core Learning Platform
- **Comprehensive Question Bank**: Expertly curated pathology questions across subspecialties
- **Interactive Quiz System**: Multiple quiz modes (tutor, timed, untimed) with immediate feedback
- **Case-based Learning**: High-quality pathology images with detailed explanations
- **Performance Analytics**: Track progress, identify knowledge gaps, and monitor improvement
- **Subspecialty Coverage**: Content across anatomic and clinical pathology subspecialties

### Advanced Features
- **AI-Powered Content**: AI-generated questions and explanations
- **Image Management**: Advanced image viewer with zoom, pan, and annotation support
- **Tag & Category System**: Organized content by topic, difficulty, and subspecialty
- **Question Sets**: Curated collections from various sources (AI, Web, Expert, Book)
- **Version History**: Complete question revision tracking with semantic versioning (major.minor.patch)
- **User Dashboard**: Personalized learning experience with progress tracking

### Technical Features
- **Mobile Responsive**: Optimized for all devices and screen sizes
- **Real-time Updates**: Live data synchronization with Supabase
- **Offline Support**: Progressive Web App capabilities
- **Admin Interface**: Comprehensive content management system
- **Testing Suite**: Full test coverage with Jest and Playwright

## 📁 Project Structure

```
pathology-bites/
├── src/                    # Application source code
│   ├── app/               # Next.js app router pages
│   ├── components/        # Reusable UI components
│   ├── features/          # Feature-specific modules
│   └── shared/           # Shared utilities and types
├── data/                  # Active data files used by application
│   ├── cell-quiz-images.json    # Cell quiz data
│   ├── cell-quiz-references.json  # Blood cell reference data
│   ├── content_specifications_merged.json  # Content specifications
│   ├── nlm-journal-abbreviations.json  # Journal abbreviations
│   └── virtual-slides.json  # Virtual slides data
├── docs/                  # Documentation and archived data
│   └── json/             # Non-active JSON files and specifications
├── tools/                 # Utility scripts organized by file type
│   ├── python/           # Python scripts
│   ├── javascript/       # JavaScript tools
│   ├── sql/              # Database migrations and SQL scripts
│   ├── shell/            # Shell scripts
│   └── json/             # JSON data files and lists
├── docs/                  # Comprehensive documentation
├── tests/                 # End-to-end and integration tests
└── public/               # Static assets and public files
```

For detailed information about each directory, see:
- [`data/README.md`](data/README.md) - Data directory structure and content specifications
- [`tools/README.md`](tools/README.md) - Utility scripts, development tools, and database management
- [`docs/README.md`](docs/README.md) - Comprehensive project documentation
- [`tests/README.md`](tests/README.md) - Testing framework and end-to-end tests
- [`public/README.md`](public/README.md) - Static assets and public file management

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.0.0 or later
- **npm** or **yarn** package manager
- **Git** for version control
- **Supabase account** for backend services

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jjsanchezramirez/pathology-bites.git
   cd pathology-bites
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Update the environment variables in `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open the application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

For detailed setup instructions, see the [Developer Setup Guide](docs/development/DEVELOPER_SETUP.md).

### Quick Development Commands

```bash
# Development with Turbo (faster)
npm run dev:turbo

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
npm run test:watch
npm run test:coverage

# E2E Testing
npm run test:e2e
npm run test:e2e:ui
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: [Next.js 15.3.2](https://nextjs.org/) with App Router
- **React**: [React 19.1.0](https://reactjs.org/) with latest features
- **UI Library**: [shadcn/ui](https://ui.shadcn.com/) components
- **Styling**: [Tailwind CSS v4.1.7](https://tailwindcss.com/) with modern syntax
- **Icons**: [Lucide React](https://lucide.dev/) for consistent iconography
- **Animations**: [Tailwind CSS Animate](https://github.com/jamiebuilds/tailwindcss-animate)

### Backend & Database
- **Backend**: [Supabase](https://supabase.io/) for authentication, database, and storage
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Real-time**: Supabase real-time subscriptions
- **File Storage**: Supabase Storage for image management

### Development Tools
- **Language**: [TypeScript 5.8.3](https://www.typescriptlang.org/) for type safety
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://github.com/colinhacks/zod) validation
- **State Management**: React hooks and context
- **Image Processing**: [Compressor.js](https://fengyuanchen.github.io/compressorjs/) for optimization
- **Drag & Drop**: [@dnd-kit](https://dndkit.com/) for sortable interfaces

### Testing & Quality
- **Unit Testing**: [Jest](https://jestjs.io/) with [Testing Library](https://testing-library.com/)
- **E2E Testing**: [Playwright](https://playwright.dev/) for browser automation
- **Linting**: [ESLint](https://eslint.org/) with TypeScript support
- **Code Quality**: Strict TypeScript configuration

### Deployment & Monitoring
- **Hosting**: [Vercel](https://vercel.com/) with automatic deployments
- **Analytics**: [Vercel Analytics](https://vercel.com/analytics) for performance monitoring
- **Email**: [Resend](https://resend.com/) for transactional emails

## 📂 Project Structure

The project follows a **feature-based architecture** for better maintainability and scalability:

```
pathology-bites/
├── public/                    # Static assets (images, icons, etc.)
├── e2e/                      # End-to-end tests (Playwright)
├── src/
│   ├── __tests__/            # Global test utilities and types
│   ├── app/                  # Next.js App Router (route definitions)
│   │   ├── (admin)/         # Admin dashboard routes
│   │   │   ├── admin/       # Admin pages (users, questions, images)
│   │   │   └── layout.tsx   # Admin layout wrapper
│   │   ├── (auth)/          # Authentication routes
│   │   │   ├── login/       # Login page
│   │   │   ├── signup/      # Registration page
│   │   │   ├── forgot-password/ # Password reset
│   │   │   ├── reset-password/  # Password reset form
│   │   │   ├── verify-email/    # Email verification
│   │   │   └── link-expired/    # Expired link page
│   │   ├── (dashboard)/     # User dashboard routes
│   │   │   └── dashboard/   # User dashboard pages
│   │   │       ├── quiz/    # Quiz interface
│   │   │       ├── progress/ # Progress tracking
│   │   │       └── goals/   # Learning goals
│   │   ├── (public)/        # Public pages (landing, about, etc.)
│   │   └── api/             # API routes and server actions
│   │       ├── auth/        # Authentication endpoints
│   │       ├── admin/       # Admin API endpoints
│   │       ├── quiz/        # Quiz-related endpoints
│   │       └── health/      # Health check endpoint
│   ├── features/             # Feature-based modules
│   │   ├── auth/            # Authentication feature
│   │   │   ├── components/  # Auth UI components
│   │   │   │   ├── forms/   # Login, signup, reset forms
│   │   │   │   ├── ui/      # Auth-specific UI elements
│   │   │   │   └── __tests__/ # Component tests
│   │   │   ├── hooks/       # Auth-related hooks
│   │   │   ├── services/    # Auth API calls and actions
│   │   │   ├── types/       # Auth TypeScript types
│   │   │   └── utils/       # Auth utility functions
│   │   ├── questions/       # Question management
│   │   │   ├── components/  # Question forms, tables, dialogs
│   │   │   ├── hooks/       # Question-related hooks
│   │   │   ├── services/    # Question API calls
│   │   │   ├── types/       # Question types
│   │   │   └── utils/       # Question utilities
│   │   ├── images/          # Image management
│   │   ├── users/           # User management
│   │   ├── dashboard/       # Dashboard components
│   │   └── quiz/            # Quiz system
│   ├── shared/              # Shared across all features
│   │   ├── components/      # Reusable UI components
│   │   │   ├── ui/         # Base shadcn/ui components
│   │   │   ├── layout/     # Layout components (header, sidebar)
│   │   │   └── common/     # Common reusable components
│   │   ├── hooks/          # Shared custom hooks
│   │   ├── services/       # Shared services (Supabase, etc.)
│   │   ├── types/          # Shared TypeScript types
│   │   └── utils/          # Utility functions
│   ├── styles/             # Global CSS and Tailwind
│   └── middleware.ts       # Next.js middleware
├── jest.config.js          # Jest testing configuration
├── jest.setup.js           # Jest setup file
├── playwright.config.ts    # Playwright E2E configuration
├── postcss.config.js       # PostCSS configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── next.config.ts          # Next.js configuration
└── tsconfig.json          # TypeScript configuration
```

### Architecture Principles

- **Feature-based organization**: Each feature is self-contained with its own components, hooks, services, and types
- **Shared resources**: Common utilities, UI components, and services are centralized in the `shared` directory
- **Route grouping**: Next.js route groups organize pages by user type (admin, auth, dashboard, public)
- **Type safety**: Full TypeScript coverage with strict configuration
- **Testing**: Comprehensive test coverage with unit and E2E tests

## 💻 Key Features in Detail

### Question Management System

The platform provides a comprehensive question management system:

- **Question Bank**: Curated pathology questions across all subspecialties
- **Multiple Question Types**: Multiple-choice with detailed explanations
- **Difficulty Levels**: Questions ranging from beginner to advanced level
- **Rich Content**: High-quality pathology images with zoom and pan capabilities
- **Teaching Points**: Comprehensive explanations for each answer
- **References**: Citations to relevant literature and educational resources
- **Categorization**: Organized by anatomic/clinical pathology subspecialties
- **Tagging System**: Flexible tagging for topic-based organization
- **Question Sets**: Curated collections from various sources (AI, Web, Expert, Book, Other)

### Question Version History

Complete revision tracking and change management:

- **Semantic Versioning**: Automatic version numbering using major.minor.patch format
- **Change Classification**: Categorize updates as patch (typos/formatting), minor (content changes), or major (complete rewrites)
- **Change Summaries**: Required descriptions for all question modifications
- **Version Comparison**: Side-by-side comparison of different question versions
- **Complete History**: Chronological display of all question revisions with timestamps
- **Rollback Capability**: Ability to view and reference previous versions
- **Audit Trail**: Full tracking of who made changes and when

### Advanced Quiz System

Interactive learning with multiple quiz modes:

- **Tutor Mode**: Immediate feedback after each question with explanations
- **Timed Mode**: Assessment with time constraints for exam preparation
- **Untimed Mode**: Self-paced learning without time pressure
- **Progress Tracking**: Real-time performance analytics and improvement metrics
- **Adaptive Learning**: Question selection based on performance history

### Image Management

Specialized pathology image handling:

- **High-Resolution Support**: View detailed microscopic and gross pathology images
- **Advanced Viewer**: Zoom, pan, and navigate through high-magnification slides
- **Image Optimization**: Automatic compression and format optimization
- **Batch Upload**: Efficient bulk image management for administrators
- **Metadata Management**: Comprehensive image tagging and categorization
- **Storage Integration**: Seamless Supabase storage integration

### Admin Dashboard

Comprehensive content management system:

- **User Management**: Admin controls for user accounts and permissions
- **Content Creation**: Intuitive interfaces for creating questions and managing images
- **Category Management**: Hierarchical organization of pathology subspecialties
- **Tag Management**: Flexible tagging system for content organization
- **Analytics**: Platform usage statistics and performance metrics
- **Bulk Operations**: Efficient tools for managing large content volumes

### User Dashboard

Personalized learning experience:

- **Progress Tracking**: Detailed analytics on learning progress and performance
- **Goal Setting**: Customizable learning objectives and milestones
- **Learning Paths**: Structured pathways through pathology subspecialties
- **Performance Analytics**: Identify strengths and areas for improvement
- **Study History**: Track completed quizzes and review sessions

## 🧪 Development

### Development Workflow

This project follows modern development practices with comprehensive tooling:

#### Code Quality & Standards
```bash
# Linting and code formatting
npm run lint              # Check for linting errors
npm run lint:fix          # Auto-fix linting issues
npm run type-check        # TypeScript type checking
npm run cleanup           # Clean dependencies and fix issues
```

#### Testing Strategy
```bash
# Unit Testing (Jest + Testing Library)
npm run test              # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
npm run test:auth         # Run authentication-specific tests

# End-to-End Testing (Playwright)
npm run test:e2e          # Run E2E tests headlessly
npm run test:e2e:ui       # Run E2E tests with UI
```

#### Development Modes
```bash
# Development servers
npm run dev               # Standard development server
npm run dev:turbo         # Faster development with Turbo

# Build and production
npm run build             # Production build
npm run start             # Start production server
npm run clean             # Clean build artifacts
```

### Working with Tailwind CSS v4

This project uses the latest Tailwind CSS v4 with updated syntax:

- **Color opacity**: Use `-50%` format instead of `/50` (e.g., `bg-blue-500-50%`)
- **Arbitrary properties**: Use `--` prefix (e.g., `[--mask-type:luminance]`)
- **Preflight**: CSS reset is separate from `@tailwind base`
- **Modern features**: Enhanced performance and smaller bundle sizes

### Feature Development Guidelines

When developing new features:

1. **Create feature directory** in `src/features/[feature-name]/`
2. **Organize by concern**: components, hooks, services, types, utils
3. **Export from index.ts** for clean imports
4. **Write tests** for components and utilities
5. **Update shared types** if needed
6. **Follow TypeScript strict mode** requirements

### Database Development

Working with Supabase:

```bash
# Database types are auto-generated
# Update src/shared/types/supabase.ts when schema changes

# Test database connections
npm run test:auth         # Test auth flows
```

### Component Development

Using shadcn/ui components:

```bash
# Add new UI components
npx shadcn-ui@latest add [component-name]

# Components are automatically added to src/shared/components/ui/
```

## 📚 Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[Developer Setup](docs/development/DEVELOPER_SETUP.md)** - Complete development environment setup
- **[Project Roadmap](docs/project/PATHOLOGY_BITES_ROADMAP.md)** - 30-day implementation plan and progress
- **[Question Review Workflow](docs/features/QUESTION_REVIEW_WORKFLOW.md)** - Question approval process
- **[JSON Import Feature](docs/features/question-json-import.md)** - Bulk question import guide
- **[Documentation Index](docs/README.md)** - Full documentation overview

## 🚢 Deployment

### Automated Deployment (Recommended)

The project is configured for automatic deployment on Vercel:

- **Main branch**: Automatically deploys to production
- **Feature branches**: Create preview deployments
- **Pull requests**: Generate preview links for testing

### Manual Deployment via Vercel CLI

For manual deployments or local testing:

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   # Preview deployment
   vercel

   # Production deployment
   vercel --prod
   ```

### Environment Variables

Ensure these environment variables are set in your deployment:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Email Configuration (Resend)
RESEND_API_KEY=your_resend_api_key

# Optional: Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
```

### Build Optimization

The project includes several optimizations:

- **Next.js 15**: Latest performance improvements
- **Image optimization**: Automatic WebP conversion and sizing
- **Bundle analysis**: Built-in bundle size monitoring
- **Edge runtime**: Optimized for Vercel Edge Functions
- **Static generation**: Pre-rendered pages where possible

### Health Checks

Monitor deployment health:

```bash
# Health check endpoint
curl https://your-domain.com/api/health

# Response: {"status": "ok", "timestamp": "..."}
```

## 👥 Contributing

We welcome contributions to Pathology Bites! This project is open source and benefits from community involvement.

### Getting Started with Contributing

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/pathology-bites.git
   cd pathology-bites
   ```
3. **Install dependencies** and set up the development environment
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Workflow

1. **Make your changes** following the project structure and conventions
2. **Write tests** for new functionality
3. **Run the test suite** to ensure everything works:
   ```bash
   npm run test
   npm run test:e2e
   npm run lint
   npm run type-check
   ```
4. **Commit your changes** with descriptive messages:
   ```bash
   git commit -m "feat: add new quiz mode functionality"
   ```
5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request** with a clear description of your changes

### Contribution Guidelines

- **Code Style**: Follow the existing code style and linting rules
- **Testing**: Include tests for new features and bug fixes
- **Documentation**: Update documentation for significant changes
- **Type Safety**: Maintain strict TypeScript compliance
- **Feature Structure**: Follow the feature-based architecture
- **Commit Messages**: Use conventional commit format when possible

### Areas for Contribution

- **Content**: Add new pathology questions and explanations
- **Features**: Implement new learning modes or tools
- **UI/UX**: Improve user interface and experience
- **Performance**: Optimize loading times and responsiveness
- **Testing**: Expand test coverage
- **Documentation**: Improve guides and API documentation
- **Accessibility**: Enhance accessibility features

### Code Review Process

All contributions go through code review:

1. **Automated checks**: Tests, linting, and type checking must pass
2. **Manual review**: Code quality, architecture, and functionality review
3. **Testing**: Feature testing in preview deployments
4. **Approval**: Maintainer approval before merging

## 🔧 Troubleshooting

### Common Issues

**Build Errors:**
```bash
# Clear Next.js cache
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Database Connection Issues:**
- Verify Supabase environment variables
- Check Supabase project status
- Ensure RLS policies are properly configured

**Type Errors:**
```bash
# Regenerate TypeScript types
npm run type-check
```

**Test Failures:**
```bash
# Run tests with verbose output
npm run test -- --verbose

# Update test snapshots if needed
npm run test -- --updateSnapshot
```

### Performance Optimization

- **Images**: Use WebP format and appropriate sizing
- **Bundle Size**: Monitor with `npm run build` output
- **Database**: Optimize queries and use proper indexing
- **Caching**: Leverage Next.js caching strategies

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact & Support

For questions, feedback, or support:

- **GitHub Issues**: [Report bugs or request features](https://github.com/jjsanchezramirez/pathology-bites/issues)
- **Email**: support@pathologybites.com
- **Documentation**: Check this README and inline code documentation

## 🙏 Acknowledgments

- **Medical Professionals**: Pathologists and educators who contribute content and expertise
- **Open Source Community**: Maintainers of Next.js, React, Supabase, and other amazing tools
- **Contributors**: All developers who help improve the platform
- **Users**: Medical students, residents, and professionals who provide valuable feedback
- **Educational Institutions**: Organizations supporting open medical education

## 🚀 Roadmap

### Upcoming Features
- **Mobile App**: Native iOS and Android applications
- **Advanced Analytics**: Detailed learning analytics and insights
- **Collaborative Features**: Study groups and peer learning
- **Content Expansion**: More subspecialties and question types
- **AI Integration**: Enhanced AI-powered learning recommendations
- **Offline Mode**: Full offline functionality for mobile learning

### Technical Improvements
- **Performance**: Further optimization for faster loading
- **Accessibility**: Enhanced accessibility features
- **Internationalization**: Multi-language support
- **API**: Public API for educational integrations

---

**Made with ❤️ for the pathology education community**

*Pathology Bites - Making pathology education accessible, interactive, and effective for everyone.*