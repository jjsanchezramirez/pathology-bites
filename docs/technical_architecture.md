# Technical Architecture

## State Management

Pathology Bites uses a simple, effective state management approach without complex libraries like Redux or Zustand. See [State Management Guide](./state-management-guide.md) for detailed information.

### Key Patterns
- **Local State**: `useState` for component-specific state
- **Server State**: Supabase + custom hooks for data fetching
- **Auth State**: Centralized authentication hook
- **URL State**: Next.js router + search params (with Suspense boundaries)

### Suspense Usage
In Next.js 15, components using `useSearchParams()` must be wrapped in Suspense boundaries for static generation. We use this pattern in:
- Analytics provider (page tracking)
- Components with URL parameter handling
- Review queue tab initialization

## Database Architecture

### Schema Overview
The system uses PostgreSQL via Supabase with 21 tables, 19 functions, and 6 views, all protected by Row-Level Security (RLS).

### Core Tables

#### User Management
```sql
users
├── id (uuid, PK)
├── email (text, unique)
├── first_name, last_name (text)
├── role (admin | creator | reviewer | user)
├── status (active | inactive | suspended)
├── created_at, updated_at (timestamptz)
```

#### Question System
```sql
questions
├── id (uuid, PK)
├── title (text, NOT NULL)
├── stem (text, NOT NULL)           -- Question content
├── difficulty (easy | medium | hard)
├── teaching_point (text, NOT NULL)
├── status (draft | under_review | published | rejected)
├── created_by, updated_by (uuid, FK → users.id)
├── version_major, version_minor, version_patch (integer)
├── category_id (uuid, FK → categories.id)
├── question_set_id (uuid, FK → sets.id)
├── search_vector (tsvector)
└── timestamps

question_options
├── id (uuid, PK)
├── question_id (uuid, FK → questions.id)
├── text (text, NOT NULL)
├── is_correct (boolean)
├── explanation (text)
├── order_index (integer)
└── timestamps
```

#### Quiz System
```sql
quiz_sessions
├── id (uuid, PK)
├── user_id (uuid, FK → users.id)
├── question_ids (text[])
├── current_question_index (integer)
├── total_questions (integer)
├── time_limit (integer)
├── started_at, completed_at (timestamptz)
└── timestamps

quiz_attempts
├── id (uuid, PK)
├── quiz_session_id (uuid, FK → quiz_sessions.id)
├── question_id (uuid, FK → questions.id)
├── selected_answer_id (uuid, FK → question_options.id)
├── is_correct (boolean)
├── time_spent (integer)
└── timestamps
```

#### Content Organization
```sql
categories
├── id (uuid, PK)
├── name (text, NOT NULL)
├── parent_id (uuid, FK → categories.id)
├── level (integer)
└── timestamps

tags
├── id (uuid, PK)
├── name (text, unique)
└── created_at

images
├── id (uuid, PK)
├── url (text, NOT NULL)
├── storage_path (text)
├── category (microscopic | gross | figure | table | external)
├── file_size_bytes (bigint)
├── created_by (uuid, FK → users.id)
└── timestamps
```

#### Review & Analytics
```sql
question_reviews
├── id (uuid, PK)
├── question_id (uuid, FK → questions.id)
├── reviewer_id (uuid, FK → users.id)
├── action (approve | reject)
├── feedback (text)
└── created_at

question_analytics
├── id (uuid, PK)
├── question_id (uuid, FK → questions.id, unique)
├── total_attempts (integer)
├── correct_attempts (integer)
├── success_rate (numeric)
├── difficulty_score (numeric)
├── last_calculated_at (timestamptz)
└── timestamps

audit_logs
├── id (uuid, PK)
├── user_id (uuid, FK → users.id)
├── action (text)
├── resource_type (text)
├── resource_id (uuid)
├── old_values, new_values (jsonb)
├── ip_address (inet)
└── created_at
```

#### Planned Schema Extensions (Versioning & Collaboration)
```sql
-- Question versioning system
question_versions
├── id (uuid, PK)
├── question_id (uuid, FK → questions.id)
├── version_major (integer, NOT NULL, DEFAULT 1)
├── version_minor (integer, NOT NULL, DEFAULT 0)
├── version_patch (integer, NOT NULL, DEFAULT 0)
├── version_string (text, GENERATED)
├── question_data (jsonb, NOT NULL)  -- Complete question snapshot
├── update_type (text, CHECK: patch|minor|major)
├── change_summary (text)
├── changed_by (uuid, FK → users.id)
└── created_at (timestamptz)

-- Enhanced review system
question_reviews_enhanced
├── id (uuid, PK)
├── question_id (uuid, FK → questions.id)
├── version_id (uuid, FK → question_versions.id)
├── reviewer_id (uuid, FK → users.id)
├── action (text, CHECK: approve|request_changes|reject)
├── feedback (text)
├── changes_made (jsonb)
└── created_at (timestamptz)

-- Collaboration sessions
question_collaboration_sessions
├── id (uuid, PK)
├── question_id (uuid, FK → questions.id)
├── owner_id (uuid, FK → users.id)
├── collaborators (uuid[])
├── session_data (jsonb)
├── is_active (boolean, DEFAULT true)
├── expires_at (timestamptz)
├── created_at (timestamptz)
└── updated_at (timestamptz)

-- Comment system
question_comments
├── id (uuid, PK)
├── question_id (uuid, FK → questions.id)
├── user_id (uuid, FK → users.id)
├── content (text, NOT NULL)
├── comment_type (text, CHECK: general|suggestion|review)
├── parent_id (uuid, FK → question_comments.id)
├── resolved (boolean, DEFAULT false)
└── created_at (timestamptz)
```

### Database Security

#### Row-Level Security (RLS)
**100% Coverage** - All 21 tables have RLS policies:

```sql
-- Users can only access their own data
CREATE POLICY "users_own_data" ON quiz_sessions
  FOR ALL USING (user_id = auth.uid());

-- Admin/reviewer access to questions
CREATE POLICY "admin_reviewer_questions" ON questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'reviewer')
    )
  );

-- Published questions are publicly readable
CREATE POLICY "published_questions_public" ON questions
  FOR SELECT USING (status = 'published');
```

#### Database Functions
**19 Secure Functions** with proper security settings:

```sql
-- All functions use secure configuration
CREATE OR REPLACE FUNCTION function_name()
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Prevents search path attacks
AS $$
-- Function body
$$;
```

**Key Functions:**
- `calculate_question_analytics()` - Real-time analytics
- `create_question_version()` - Version control
- `handle_new_user()` - User registration
- `update_search_vectors()` - Full-text search
- `select_demo_questions()` - Demo question selection

#### Database Views
**6 Secure Views** for complex queries:

```sql
-- All views use SECURITY INVOKER
CREATE VIEW view_name WITH (security_invoker = true) AS
SELECT ... FROM tables WHERE security_conditions;
```

**Key Views:**
- `v_dashboard_stats` - Real-time dashboard metrics
- `v_flagged_questions` - Content requiring attention
- `v_storage_stats` - Storage utilization
- `v_orphaned_images` - Unused images for cleanup

### Performance Optimization

#### Strategic Indexes
- **Search**: GIN indexes for full-text search
- **Foreign Keys**: All relationships indexed
- **Queries**: Composite indexes for common queries
- **Analytics**: Specialized indexes for metrics

#### Query Optimization
- **Pagination**: Efficient LIMIT/OFFSET patterns
- **Joins**: Optimized relationship queries
- **Aggregations**: Indexed group by operations
- **Search**: tsvector for full-text search

## API Architecture

### Endpoint Structure
```
/api/
├── auth/              # Authentication endpoints
├── admin/             # Admin-only endpoints
├── questions/         # Question management
├── quiz/              # Quiz functionality
├── users/             # User management
├── analytics/         # Analytics data
└── csrf-token/        # CSRF protection
```

### Authentication Flow
```typescript
// JWT-based authentication
interface AuthToken {
  sub: string        // User ID
  role: string       // User role
  exp: number        // Expiration
  iat: number        // Issued at
}

// Middleware validation
async function validateAuth(request: NextRequest) {
  const token = await getToken(request)
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Verify role permissions
  const hasPermission = await checkPermission(token.role, request.url)
  if (!hasPermission) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  return NextResponse.next()
}
```

### API Security

#### Rate Limiting
**Configurable per endpoint:**
- Authentication: 10 requests/15 minutes
- General API: 100 requests/minute
- Admin API: 200 requests/minute
- Quiz API: 50 requests/minute

#### Input Validation
```typescript
// Zod schema validation
const CreateQuestionSchema = z.object({
  title: z.string().min(1).max(200),
  stem: z.string().min(10).max(2000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10).max(1000),
  answer_options: z.array(z.object({
    text: z.string().min(1),
    is_correct: z.boolean(),
    explanation: z.string().optional()
  })).min(2).max(10)
})
```

#### Error Handling
```typescript
// Standardized error responses
interface APIError {
  error: string
  code: string
  details?: Record<string, any>
  timestamp: string
}

// HTTP status codes
const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500
}
```

## Security Architecture

### Multi-Layer Security

#### 1. Network Security
- **HTTPS**: All traffic encrypted with TLS 1.3
- **CORS**: Restricted origins configuration
- **Headers**: Security headers (CSP, HSTS, etc.)
- **Rate Limiting**: Per-endpoint protection

#### 2. Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Session Management**: Device fingerprinting
- **CSRF Protection**: Token-based validation
- **Password Security**: Bcrypt hashing

#### 3. Database Security
- **Row-Level Security**: 100% table coverage
- **Function Security**: Search path protection
- **View Security**: Security invoker mode
- **Audit Logging**: Complete activity tracking

#### 4. Application Security
- **Input Validation**: Zod schema validation
- **Output Encoding**: XSS prevention
- **SQL Injection Prevention**: Parameterized queries
- **Error Handling**: No information disclosure

### CSRF Protection
```typescript
// Token management
interface CSRFToken {
  token: string
  expires: number
  fingerprint: string
}

// Automatic form protection
const CSRFForm = ({ children, onSubmit }) => {
  const { token } = useCSRFToken()
  return (
    <form onSubmit={(e) => addCSRFToken(e, token, onSubmit)}>
      {children}
    </form>
  )
}
```

### Session Security
```typescript
// Device fingerprinting
interface SessionFingerprint {
  userAgent: string
  screen: string
  timezone: string
  language: string
  platform: string
  timestamp: number
}

// Risk assessment
type SecurityRisk = 'low' | 'medium' | 'high'

const validateSession = (stored: SessionFingerprint, current: SessionFingerprint): SecurityRisk => {
  // Compare fingerprints and assess risk
  if (stored.userAgent !== current.userAgent) return 'high'
  if (stored.platform !== current.platform) return 'high'
  if (stored.timezone !== current.timezone) return 'medium'
  return 'low'
}
```

## Application Architecture

### Component Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (admin)/           # Admin routes
│   ├── (auth)/            # Authentication
│   ├── (dashboard)/       # User dashboard
│   ├── (public)/          # Public pages
│   └── api/               # API routes
├── features/              # Feature modules
│   ├── auth/              # Authentication
│   ├── questions/         # Question management
│   ├── quiz/              # Quiz system
│   ├── users/             # User management
│   └── images/            # Image management
├── shared/                # Shared components
│   ├── components/        # UI components
│   ├── hooks/             # Custom hooks
│   ├── services/          # API services
│   ├── types/             # TypeScript types
│   └── utils/             # Utilities
└── styles/                # Global styles
```

### State Management
```typescript
// Authentication state
interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  error: AuthError | null
  securityRisk: 'low' | 'medium' | 'high'
}

// Application state patterns
const useAuth = () => {
  const [state, setState] = useState<AuthState>(initialState)
  
  // Authentication methods
  const login = async (credentials: LoginCredentials) => { /* ... */ }
  const logout = async () => { /* ... */ }
  const refreshAuth = async () => { /* ... */ }
  
  return { ...state, login, logout, refreshAuth }
}
```

## Performance Architecture

### Frontend Optimization
- **SSR**: Server-side rendering with Next.js
- **Code Splitting**: Automatic route splitting
- **Image Optimization**: Next.js Image component
- **Caching**: SWR for client-side caching

### Database Optimization
- **Connection Pooling**: Supabase connection management
- **Query Optimization**: Efficient queries with indexes
- **Materialized Views**: Pre-computed statistics
- **Full-Text Search**: PostgreSQL GIN indexes

### API Optimization
- **Response Caching**: Strategic API caching
- **Pagination**: Efficient data loading
- **Compression**: Gzip response compression
- **CDN**: Global content delivery

## Monitoring & Observability

### Application Monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time monitoring
- **User Analytics**: Usage pattern analysis
- **Security Monitoring**: Threat detection

### Database Monitoring
- **Query Performance**: Slow query detection
- **Connection Health**: Pool monitoring
- **Storage Usage**: Capacity tracking
- **RLS Performance**: Policy efficiency

### Health Checks
```typescript
// Application health endpoint
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    auth: await checkAuth(),
    timestamp: new Date().toISOString()
  }

  const allHealthy = Object.values(checks).every(check => 
    typeof check === 'boolean' ? check : check.status === 'healthy'
  )

  return NextResponse.json(checks, { 
    status: allHealthy ? 200 : 503 
  })
}
```

## Deployment Architecture

### Current Environment
- **Frontend**: Vercel with Edge Network
- **Database**: Supabase cloud PostgreSQL
- **Storage**: Supabase Storage (500MB)
- **Monitoring**: Built-in analytics

### Scaling Strategy
- **Horizontal Scaling**: Multiple Vercel instances
- **Database Scaling**: Supabase plan upgrades
- **CDN Optimization**: Global content delivery
- **Caching**: Multi-layer caching strategy

### Backup & Recovery
- **Database Backups**: Daily automated backups
- **Point-in-Time Recovery**: Supabase PITR
- **Code Backups**: Git version control
- **Disaster Recovery**: Multi-region strategy

---

*Last Updated: January 2025*