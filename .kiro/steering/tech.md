# Technology Stack & Development

## Core Technologies
- **Framework**: Next.js 15.3.2 with App Router
- **Runtime**: React 19.1.0 with latest features
- **Language**: TypeScript 5.8.3 (strict mode)
- **Styling**: Tailwind CSS v4.1.11 with modern syntax
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Real-time)

## UI & Components
- **Component Library**: shadcn/ui with Radix UI primitives
- **Icons**: Lucide React for consistent iconography
- **Animations**: Tailwind CSS Animate + custom keyframes
- **Forms**: React Hook Form with Zod validation
- **Drag & Drop**: @dnd-kit for sortable interfaces

## Development Tools
- **Testing**: Jest + Testing Library (unit), Playwright (E2E)
- **Linting**: ESLint with TypeScript support
- **Type Checking**: Strict TypeScript configuration
- **Package Manager**: npm (use npm, not yarn)

## Common Commands

### Development
```bash
npm run dev              # Standard development server
npm run dev:turbo        # Faster development with Turbo
npm run type-check       # TypeScript type checking
npm run lint             # Check for linting errors
npm run lint:fix         # Auto-fix linting issues
```

### Testing
```bash
npm run test             # Run all unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run E2E tests headlessly
npm run test:e2e:ui      # Run E2E tests with UI
```

### Build & Deploy
```bash
npm run build            # Production build
npm run start            # Start production server
npm run clean            # Clean build artifacts
```

## Key Libraries
- **Database**: @supabase/supabase-js, @supabase/ssr
- **Image Processing**: Compressor.js, html2canvas, jspdf
- **Utilities**: date-fns, clsx, tailwind-merge
- **Analytics**: @vercel/analytics

## Environment Variables
Required for development:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Tailwind CSS v4 Notes
- Use `-50%` format for opacity (not `/50`)
- Use `--` prefix for arbitrary properties
- Modern syntax with enhanced performance