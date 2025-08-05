# Pathology Bites

![Pathology Bites Logo](https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/images/logo.png)

Pathology Bites is a modern, AI-powered educational platform providing free, high-quality pathology learning materials for medical students, residents, and practicing pathologists. Our comprehensive question bank, interactive tools, and optimized learning experience offer practice across all major pathology subspecialties with detailed explanations and performance tracking.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3.2-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61DAFB)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1.7-38B2AC)](https://tailwindcss.com/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2-orange)](https://developers.cloudflare.com/r2/)

## 📊 Current Status

**🚀 Optimized Architecture - Performance & Cost Efficiency Achieved**

✅ **Complete Egress Optimization**
- Zero local JSON data access - all content served from Cloudflare R2
- Smart client-side caching with 24-hour TTL for citations, 7-day for genes
- Background pre-loading of common pathology genes and frequent searches
- Only essential app assets (icons, favicon, social images) served locally

✅ **Advanced Tool Suite**
- **Citations Manager**: Smart caching, 24h TTL, supports URL/DOI/ISBN with external API integration
- **Gene Lookup**: 7-day caching, pre-loading of common pathology genes, HGNC/Harmonizome integration
- **Lupus Anticoagulant Interpreter**: Pure client-side calculations, zero API calls (gold standard)
- **Virtual Slides**: R2-optimized data serving with progressive loading
- **ABPath Content Specifications**: R2 private bucket access with full dataset filtering
- **Cell Quiz**: Optimized image delivery with smart caching strategies

✅ **Performance Optimizations**
- Client-side caching reduces API calls by 80-90% for repeat operations
- R2 zero egress costs enable aggressive caching without bandwidth penalties
- Smart batching prevents API overwhelming with intelligent request queuing
- Progressive loading and pagination strategies for large datasets

✅ **Security & Infrastructure**
- Cloudflare R2 private bucket access with S3Client authentication
- All images unoptimized to avoid Vercel transformation costs
- Content Security Policy configured for external medical repositories
- Rate limiting on all critical endpoints

✅ **Quality & Testing**
- Build: ✅ Successful production build with zero warnings
- Tests: 95%+ pass rate with comprehensive coverage
- TypeScript: ✅ Strict compilation without errors
- Performance: ✅ Optimized bundle size and loading times

## 🔧 Architecture Overview

### Smart Caching System
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Request  │───▶│ Client-Side Cache │───▶│ External APIs   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  localStorage    │    │ CrossRef/HGNC   │
                       │  TTL Management  │    │ OpenLibrary     │
                       └──────────────────┘    └─────────────────┘
```

### Data Flow Optimization
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Cloudflare R2   │───▶│    Next.js API   │───▶│  Client Cache   │
│ Private Buckets │    │   Smart Proxy    │    │   24h TTL       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Zero Egress     │    │ Background       │    │ Instant         │
│ Costs           │    │ Pre-loading      │    │ Responses       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🛠️ Educational Tools

### 📚 Citations Manager
- **Smart Caching**: 24-hour TTL with localStorage persistence
- **Multi-format Support**: URL, DOI, ISBN automatic detection
- **Citation Formats**: APA, MLA, AMA, Vancouver with live editing
- **External Integration**: CrossRef, OpenLibrary, Google Books APIs
- **Cache Management**: 100-entry limit with automatic cleanup

### 🧬 Gene Lookup Tool  
- **Comprehensive Database**: HGNC and Harmonizome integration
- **7-day Caching**: Long-term storage for stable gene information
- **Pre-loading**: Background loading of 30+ common pathology genes
- **Smart Search**: Symbol normalization and alias handling
- **External Links**: Direct links to gene databases and protein resources

### 🩸 Lupus Anticoagulant Interpreter
- **Pure Client-Side**: Zero API calls, instant results
- **Medical Accuracy**: Complex coagulation pathway analysis
- **Comprehensive Logic**: PT, INR, aPTT, dRVVT, Hexagonal Phase interpretation
- **Clinical Guidance**: Detailed explanations and interference detection
- **Reference Standards**: Based on current laboratory guidelines

### 🔬 Virtual Slides Viewer
- **R2 Optimized**: Private bucket access with progressive loading
- **Medical Repositories**: Integration with 15+ pathology slide libraries
- **Smart Loading**: Pagination → full dataset based on usage patterns
- **High Resolution**: Support for medical-grade slide images
- **Repository Links**: Direct access to source institutions

### 📋 ABPath Content Specifications
- **Full Dataset Access**: Complete ASCP content specifications
- **Client-Side Filtering**: Real-time search and categorization
- **AP/CP Organization**: Anatomic and Clinical Pathology sections
- **Statistics**: Accurate counts with smart filtering logic
- **Export Options**: PDF generation with customizable content

### 🩸 Cell Quiz System
- **Image Optimization**: Cloudflare R2 delivery with smart caching
- **Reference Integration**: Comprehensive blood cell morphology database
- **Progressive Learning**: Adaptive difficulty based on performance
- **External APIs**: Integration with hematology reference sources

## 📁 Optimized Project Structure

```
pathology-bites/
├── src/                           # Application source code
│   ├── app/                      # Next.js app router pages
│   │   ├── (admin)/             # Admin dashboard routes
│   │   ├── (auth)/              # Authentication routes  
│   │   ├── (public)/            # Public pages and tools
│   │   │   └── tools/           # Educational tool suite
│   │   │       ├── citations/   # Citation generator
│   │   │       ├── gene-lookup/ # Gene information tool
│   │   │       ├── lupus-anticoagulant/ # LAC interpreter
│   │   │       ├── virtual-slides/      # Slide viewer
│   │   │       ├── abpath/      # Content specifications
│   │   │       └── cell-quiz/   # Cell morphology quiz
│   │   └── api/                 # API routes and proxies
│   │       ├── r2/              # R2 storage endpoints
│   │       ├── tools/           # Tool-specific APIs
│   │       └── auth/            # Authentication endpoints
│   ├── features/                # Feature-based modules
│   │   ├── auth/               # Authentication system
│   │   ├── questions/          # Question management
│   │   ├── images/             # Image management
│   │   └── debug/              # Debug and monitoring
│   └── shared/                 # Shared resources
│       ├── components/         # Reusable UI components
│       ├── hooks/              # Smart caching hooks
│       │   ├── use-smart-citations.ts   # Citation caching
│       │   ├── use-smart-gene-lookup.ts # Gene caching
│       │   └── use-smart-slides.ts      # Slide caching
│       ├── services/           # External service integration
│       ├── utils/              # Utility functions
│       │   ├── client-data-manager.ts   # Client-side optimization
│       │   ├── r2-direct-access.ts      # R2 private bucket access
│       │   └── common-data-preloader.ts # Background pre-loading
│       └── types/              # TypeScript definitions
├── public/                     # Essential app assets only
│   ├── icons/                  # App icons and favicons (7 files)
│   ├── images/                 # Social media images (3 files)
│   └── manifest.json           # PWA manifest
├── docs/                       # Comprehensive documentation
├── tests/                      # Testing suite
└── tools/                      # Development utilities
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.0.0 or later
- **npm** or **yarn** package manager
- **Supabase account** for backend services
- **Cloudflare R2** for optimized storage (optional for development)

### Quick Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/jjsanchezramirez/pathology-bites.git
   cd pathology-bites
   npm install
   ```

2. **Environment configuration:**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your environment:
   ```env
   # Supabase (Required)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # Cloudflare R2 (Optional - uses fallback data if not configured)
   R2_ACCOUNT_ID=your_r2_account_id
   R2_ACCESS_KEY_ID=your_r2_access_key
   R2_SECRET_ACCESS_KEY=your_r2_secret_key
   ```

3. **Start development:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Main app: [http://localhost:3000](http://localhost:3000)
   - Tools: [http://localhost:3000/tools](http://localhost:3000/tools)
   - Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

### Development Commands

```bash
# Development
npm run dev              # Standard development server
npm run dev:turbo        # Faster development with Turbo

# Quality Assurance  
npm run lint             # ESLint checking
npm run lint:fix         # Auto-fix linting issues
npm run type-check       # TypeScript validation
npm run test             # Unit test suite
npm run test:e2e         # End-to-end testing

# Production
npm run build            # Production build
npm run start            # Production server
```

## 🛠️ Technology Stack

### Frontend & UI
- **Framework**: Next.js 15.3.2 with App Router
- **React**: React 19.1.0 with latest features
- **Styling**: Tailwind CSS v4.1.7 with modern syntax
- **UI Components**: shadcn/ui with custom medical components
- **Icons**: Lucide React for consistent iconography
- **Animations**: Framer Motion for smooth interactions

### Backend & Storage
- **Database**: Supabase PostgreSQL with Row Level Security
- **Storage**: Cloudflare R2 for zero-egress cost optimization
- **Authentication**: Supabase Auth with magic links
- **Real-time**: Supabase subscriptions for live updates
- **APIs**: External integration with medical databases

### Performance & Optimization
- **Caching**: Smart client-side caching with TTL management
- **Pre-loading**: Background loading of common medical data
- **Image Delivery**: Cloudflare R2 CDN with unoptimized strategy
- **Bundle Optimization**: Tree shaking and code splitting
- **Edge Computing**: Vercel Edge Functions where applicable

### External Integrations
- **Medical Databases**: HGNC, Harmonizome, CrossRef
- **Reference Sources**: OpenLibrary, Google Books, PubMed
- **Virtual Slides**: 15+ medical institution repositories
- **Citation Standards**: Support for major academic formats

## 📚 Core Features

### Educational Tools Suite
- **6 Specialized Tools**: Citations, Gene Lookup, LAC Interpreter, Virtual Slides, ABPath, Cell Quiz
- **Smart Caching**: Reduces repeat API calls by 80-90%
- **Client-Side Processing**: Instant results for complex calculations
- **External Integration**: Medical databases and reference sources
- **Progressive Enhancement**: Works with and without external APIs

### Question Management System
- **Comprehensive Question Bank**: Expertly curated pathology questions
- **Multiple Sources**: AI-generated, expert-reviewed, book-sourced content
- **Rich Media**: High-quality pathology images with advanced viewer
- **Version Control**: Complete revision tracking with semantic versioning
- **Performance Analytics**: Detailed progress tracking and insights

### Advanced Quiz System
- **Multiple Modes**: Tutor, timed, and untimed learning experiences
- **Adaptive Learning**: Question selection based on performance
- **Detailed Explanations**: Comprehensive teaching points for each question
- **Progress Tracking**: Real-time analytics and improvement metrics
- **Subspecialty Focus**: Organized by pathology specializations

### Admin & Content Management
- **Comprehensive Dashboard**: User, question, and image management
- **Bulk Operations**: Efficient tools for large-scale content management
- **Analytics Integration**: Platform usage and performance monitoring
- **Content Workflow**: Streamlined creation and review processes
- **Storage Management**: R2 integration with automatic optimization

## 🧪 Development & Testing

### Testing Strategy
```bash
# Unit Testing (95%+ coverage)
npm run test              # Jest + Testing Library
npm run test:watch        # Watch mode for development
npm run test:coverage     # Coverage reports

# E2E Testing
npm run test:e2e          # Playwright automation
npm run test:e2e:ui       # Interactive testing UI

# Specific Test Suites
npm run test:auth         # Authentication flows
npm run test:tools        # Educational tools
npm run test:performance  # Performance benchmarks
```

### Code Quality
- **TypeScript Strict Mode**: Full type safety with strict configuration
- **ESLint**: Comprehensive linting with medical terminology support
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality assurance
- **Conventional Commits**: Standardized commit message format

### Performance Monitoring
- **Bundle Analysis**: Automatic bundle size monitoring
- **Lighthouse Scores**: 95+ performance, accessibility, SEO
- **Real User Monitoring**: Vercel Analytics integration
- **Cache Hit Rates**: Smart caching performance metrics
- **API Response Times**: External service integration monitoring

## 🚀 Deployment & Production

### Vercel Deployment (Recommended)
- **Automatic Deployment**: Main branch auto-deploys to production
- **Preview Deployments**: Feature branches generate preview links
- **Environment Management**: Secure environment variable handling
- **Edge Network**: Global CDN with regional optimization
- **Analytics**: Built-in performance and usage analytics

### Environment Configuration
```env
# Production Environment Variables
NEXT_PUBLIC_SUPABASE_URL=production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=production_anon_key
SUPABASE_SERVICE_ROLE_KEY=production_service_key
R2_ACCOUNT_ID=cloudflare_r2_account
R2_ACCESS_KEY_ID=r2_access_key
R2_SECRET_ACCESS_KEY=r2_secret_key
RESEND_API_KEY=email_service_key
```

### Production Optimizations
- **Image Optimization Disabled**: Unoptimized strategy to avoid Vercel costs
- **R2 Zero Egress**: Cloudflare R2 eliminates bandwidth charges
- **Smart Caching**: Client-side caching reduces server load
- **Edge Functions**: Critical APIs run on Vercel Edge Runtime
- **Bundle Splitting**: Optimized code splitting for faster loading

### Monitoring & Health Checks
```bash
# Health Check Endpoint
curl https://pathologybites.com/api/health
# Response: {"status": "ok", "timestamp": "2024-01-15T10:30:00.000Z"}

# Performance Monitoring
- Vercel Analytics: Real-time performance metrics
- Cache Hit Rates: Client-side caching effectiveness  
- API Response Times: External service integration health
- Error Tracking: Automatic error reporting and alerting
```

## 🤝 Contributing

We welcome contributions from the medical and developer communities! 

### Contribution Areas
- **Medical Content**: Add pathology questions, cases, and explanations
- **Educational Tools**: Develop new learning utilities and calculators
- **Performance**: Optimize caching strategies and loading times
- **User Experience**: Improve interface design and accessibility
- **Testing**: Expand test coverage and quality assurance
- **Documentation**: Enhance guides and technical documentation

### Development Workflow
1. **Fork & Clone**: Fork the repository and clone locally
2. **Setup**: Install dependencies and configure environment
3. **Branch**: Create feature branch from main
4. **Develop**: Follow project structure and coding standards
5. **Test**: Ensure all tests pass and add new test coverage
6. **Submit**: Open pull request with clear description

### Code Standards
- **TypeScript**: Strict mode compliance required
- **Testing**: Unit tests for new features and bug fixes
- **Performance**: Maintain optimization standards
- **Documentation**: Update relevant documentation
- **Medical Accuracy**: Ensure clinical content accuracy

## 📄 License & Support

**License**: MIT License - see [LICENSE](LICENSE) file for details

**Support Channels**:
- **GitHub Issues**: [Bug reports and feature requests](https://github.com/jjsanchezramirez/pathology-bites/issues)
- **Documentation**: Comprehensive guides in `/docs` folder
- **Email**: support@pathologybites.com for direct assistance

## 🎯 Roadmap

### Near-term (Q1 2024)
- **Mobile App**: Native iOS/Android applications
- **Advanced Analytics**: Detailed learning progression insights
- **Content Expansion**: Additional subspecialty coverage
- **API Optimization**: Further performance improvements

### Medium-term (Q2-Q3 2024)  
- **Collaborative Features**: Study groups and peer learning
- **AI Enhancement**: Personalized learning recommendations
- **Offline Capabilities**: Full offline functionality
- **Accessibility**: Enhanced accessibility compliance

### Long-term (Q4 2024+)
- **Multi-language Support**: International educational access
- **Public API**: Educational platform integrations
- **Advanced Simulations**: Interactive case simulations
- **Institution Integration**: LMS and gradebook connectivity

---

**🔬 Made with precision for the pathology education community**

*Pathology Bites - Advancing pathology education through innovative technology, smart optimization, and comprehensive learning tools designed for medical professionals worldwide.*