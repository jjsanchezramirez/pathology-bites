# Development Logging Guide

## Overview

This project now includes comprehensive development logging that automatically activates in development environments and remains silent in production.

## Quick Start

### Enable Development Logging

Set environment variables in your `.env.local`:

```bash
NODE_ENV=development           # Enables basic dev logging
LOG_LEVEL=verbose             # Optional: Enables verbose/debug logging
```

### Basic Usage in API Routes

```typescript
import { devLog } from '@/shared/utils/dev-logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = request.headers.get('x-request-id') || 'unknown'

  try {
    devLog.info('Processing request', { requestId })

    // Your code here

    const duration = Date.now() - startTime
    devLog.info('Request completed', { requestId, duration })

  } catch (error) {
    devLog.error('Request failed', error)
  }
}
```

## Available Logging Methods

### 1. Request/Response Logging

Automatically logs incoming requests and outgoing responses:

```typescript
devLog.request({
  method: 'GET',
  path: '/api/user/dashboard',
  userId: 'user-123',
  ip: '192.168.1.1',
  requestId: 'req_abc123',
})

devLog.response({
  method: 'GET',
  path: '/api/user/dashboard',
  status: 200,
  duration: 150,
  userId: 'user-123',
  requestId: 'req_abc123',
})
```

### 2. Database Query Logging

Track database performance:

```typescript
const queryStart = Date.now()
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)

devLog.database({
  query: 'SELECT * FROM users WHERE id = $1',
  duration: Date.now() - queryStart,
  rows: data?.length || 0,
  error: error?.message,
})
```

### 3. Performance Tracking

Monitor operation performance:

```typescript
devLog.performance('User dashboard load', duration, {
  userId: 'user-123',
  questionsCount: 50,
})
```

### 4. Authentication Events

Log auth-related events:

```typescript
devLog.auth('login', userId, true)        // Success
devLog.auth('auth_check', userId, false)  // Failure
```

### 5. Rate Limiting

Track rate limit status:

```typescript
devLog.rateLimit(
  clientIp,
  '/api/admin/users',
  remaining: 5,
  reset: new Date(resetTime)
)
```

### 6. Cache Operations

Monitor cache hits/misses:

```typescript
devLog.cache('hit', 'user-role-123', 300)  // 300s TTL
devLog.cache('miss', 'user-role-456')
devLog.cache('set', 'user-role-789', 600)
```

### 7. Debug Logging

Verbose debugging info (only with LOG_LEVEL=verbose):

```typescript
devLog.debug('Processing quiz creation', {
  mode: formData.mode,
  questionCount: formData.questionCount,
})
```

### 8. General Logging

Standard logging methods:

```typescript
devLog.info('Operation started', { operationId: '123' })
devLog.warn('Potential issue detected', { issue: 'low memory' })
devLog.error('Operation failed', error)
```

## Middleware Logging

The middleware automatically logs:

- All incoming API requests
- Authentication checks
- Rate limit status (when remaining < 10)
- CSRF validation
- Authorization failures
- Response times and status codes

Request IDs are automatically generated and propagated through headers (`x-request-id`).

## Helper Functions

### Generate Request ID

```typescript
import { generateRequestId } from '@/shared/utils/dev-logger'

const requestId = generateRequestId()
// Returns: "req_1733851234567_a7f2k9d"
```

### Get Client IP

```typescript
import { getClientIP } from '@/shared/utils/dev-logger'

const clientIp = getClientIP(request.headers)
// Returns IP from X-Forwarded-For, X-Real-IP, CF-Connecting-IP, or 'unknown'
```

### Measure Execution Time

```typescript
import { measureTime } from '@/shared/utils/dev-logger'

const { result, duration } = await measureTime(
  'Database query',
  async () => {
    return await supabase.from('users').select('*')
  }
)
```

## Example: Complete API Route with Logging

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { devLog, measureTime } from '@/shared/utils/dev-logger'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = request.headers.get('x-request-id') || 'unknown'

  try {
    devLog.info('Creating resource', { requestId })

    const supabase = await createClient()
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      devLog.warn('Unauthorized access attempt', { requestId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    devLog.debug('Request body parsed', { requestId, userId })

    // Validate input
    if (!body.name) {
      devLog.warn('Validation failed', { requestId, userId, missing: 'name' })
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }

    // Database operation with timing
    const queryStart = Date.now()
    const { data, error } = await supabase
      .from('resources')
      .insert({ name: body.name, user_id: userId })
      .select()
      .single()

    const queryDuration = Date.now() - queryStart
    devLog.database({
      query: 'INSERT INTO resources (name, user_id) VALUES ($1, $2)',
      duration: queryDuration,
      rows: 1,
      error: error?.message,
    })

    if (error) throw error

    // Success logging
    const totalDuration = Date.now() - startTime
    devLog.performance('Resource creation', totalDuration, {
      requestId,
      userId,
      resourceId: data.id,
    })

    devLog.info('Resource created successfully', {
      requestId,
      userId,
      resourceId: data.id,
      duration: totalDuration,
    })

    return NextResponse.json({ success: true, data })

  } catch (error) {
    const totalDuration = Date.now() - startTime
    devLog.error('Resource creation failed', error)
    devLog.performance('Resource creation error', totalDuration, {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    )
  }
}
```

## Log Output Format

### Development Mode

All logs include:
- Timestamp (ISO 8601)
- Log level indicator with emoji
- Structured metadata

Example output:
```
[API Request] POST /api/quiz/sessions { userId: 'user-123', ip: '192.168.1.1', requestId: 'req_abc123', timestamp: '2025-12-10T10:30:45.123Z' }

[Database Query] SELECT * FROM quiz_sessions WHERE user_id = $1 { duration: '45ms', rows: 5, timestamp: '2025-12-10T10:30:45.168Z' }

[Performance] 🚀 Quiz session creation - 150ms { requestId: 'req_abc123', sessionId: 'session-456' }

[API Response] ✅ POST /api/quiz/sessions - 200 (150ms) { userId: 'user-123', requestId: 'req_abc123', timestamp: '2025-12-10T10:30:45.273Z' }
```

### Production Mode

- Only `error` and `warn` logs are output (via secure logging)
- No debug or verbose logs
- Sensitive data is automatically sanitized

## Security

The `devLog` utility wraps `secureLog` which automatically sanitizes:
- Passwords
- API keys
- Tokens
- Session IDs
- Credit card numbers
- SSNs
- Other sensitive patterns

Never worry about accidentally logging sensitive data!

## Best Practices

1. **Always track request duration** - Use `startTime = Date.now()` at the start of handlers
2. **Use request IDs** - Get from headers: `request.headers.get('x-request-id')`
3. **Log database queries** - Track slow queries to optimize performance
4. **Log validation failures** - Helps debug client-side issues
5. **Use performance tracking** - Identify bottlenecks in your API routes
6. **Keep logs structured** - Always pass objects with meaningful keys
7. **Use appropriate log levels**:
   - `debug` - Verbose development info (requires LOG_LEVEL=verbose)
   - `info` - General information about operations
   - `warn` - Potential issues or validation failures
   - `error` - Actual errors and exceptions

## Environment Variables

| Variable | Values | Description |
|----------|--------|-------------|
| `NODE_ENV` | `development`, `production` | Controls dev logging on/off |
| `LOG_LEVEL` | `verbose`, `debug`, `info` | Controls logging verbosity |

## Files Modified/Created

- ✅ `/src/shared/utils/dev-logger.ts` - New development logger utility
- ✅ `/src/shared/services/middleware.ts` - Enhanced with request/response logging
- ✅ `/src/app/api/user/dashboard/stats/route.ts` - Example with comprehensive logging
- ✅ `/src/app/api/quiz/sessions/route.ts` - Example with comprehensive logging

## Migration Guide

To add logging to existing API routes:

1. Import the logger:
   ```typescript
   import { devLog } from '@/shared/utils/dev-logger'
   ```

2. Add timing and request ID tracking:
   ```typescript
   const startTime = Date.now()
   const requestId = request.headers.get('x-request-id') || 'unknown'
   ```

3. Add info logs at the start:
   ```typescript
   devLog.info('Operation started', { requestId })
   ```

4. Wrap database queries with timing:
   ```typescript
   const queryStart = Date.now()
   // ... your query
   devLog.database({ query: '...', duration: Date.now() - queryStart, rows: data?.length })
   ```

5. Add performance tracking before returning:
   ```typescript
   devLog.performance('Operation name', Date.now() - startTime, { requestId })
   ```

6. Replace `console.error` with `devLog.error`:
   ```typescript
   // Before
   console.error('Error:', error)

   // After
   devLog.error('Error message', error)
   ```

## Future Enhancements

Potential improvements to consider:

- Integration with external logging services (DataDog, LogRocket, Sentry)
- Structured JSON logging format for log aggregation
- Request tracing across multiple services
- Automated slow query alerts
- Performance budgets and alerting
- Log sampling in high-traffic scenarios

---

**Questions?** Check the implementation in `/src/shared/utils/dev-logger.ts` or `/src/shared/services/middleware.ts`.
