# Development Logging - Quick Reference

## Setup (One-Time)

Add to `.env.local`:
```bash
NODE_ENV=development
LOG_LEVEL=verbose  # optional
```

## Basic API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { devLog } from '@/shared/utils/dev-logger'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = request.headers.get('x-request-id') || 'unknown'

  try {
    devLog.info('Operation started', { requestId })

    // Your code here

    const duration = Date.now() - startTime
    devLog.performance('Operation completed', duration, { requestId })

    return NextResponse.json({ success: true })
  } catch (error) {
    devLog.error('Operation failed', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

## Common Patterns

### Database Query Timing
```typescript
const queryStart = Date.now()
const { data, error } = await supabase.from('users').select('*')

devLog.database({
  query: 'SELECT * FROM users',
  duration: Date.now() - queryStart,
  rows: data?.length || 0,
  error: error?.message,
})
```

### Validation Failures
```typescript
if (!formData.title) {
  devLog.warn('Validation failed', { requestId, missing: 'title' })
  return NextResponse.json({ error: 'Title required' }, { status: 400 })
}
```

### Performance Tracking
```typescript
const serviceStart = Date.now()
const result = await someService.doWork()

devLog.performance('Service operation', Date.now() - serviceStart, {
  requestId,
  recordsProcessed: result.count,
})
```

### Authentication Events
```typescript
devLog.auth('login', userId, true)  // success
devLog.auth('auth_check', userId, false)  // failure
```

### Debug Information (verbose mode only)
```typescript
devLog.debug('Processing data', {
  recordCount: data.length,
  filters: appliedFilters,
})
```

## All Available Methods

| Method | Use For | Environment |
|--------|---------|-------------|
| `devLog.request()` | Incoming requests | Dev only |
| `devLog.response()` | Outgoing responses | Dev only |
| `devLog.database()` | DB query timing | Dev + verbose |
| `devLog.debug()` | Verbose debugging | Dev + verbose |
| `devLog.info()` | General info | Dev + Production |
| `devLog.warn()` | Warnings | Dev + Production |
| `devLog.error()` | Errors | Dev + Production |
| `devLog.rateLimit()` | Rate limit events | Dev only |
| `devLog.auth()` | Auth events | Dev only |
| `devLog.cache()` | Cache ops | Dev + verbose |
| `devLog.performance()` | Timing metrics | Dev only |

## Helper Functions

```typescript
// Generate request ID
import { generateRequestId } from '@/shared/utils/dev-logger'
const requestId = generateRequestId()

// Get client IP
import { getClientIP } from '@/shared/utils/dev-logger'
const ip = getClientIP(request.headers)

// Measure async operation
import { measureTime } from '@/shared/utils/dev-logger'
const { result, duration } = await measureTime('DB query', async () => {
  return await supabase.from('users').select('*')
})
```

## Log Format

### Request
```
[API Request] GET /api/users {
  userId: 'user-123',
  ip: '192.168.1.1',
  requestId: 'req_abc123',
  timestamp: '2025-12-10T10:30:45.123Z'
}
```

### Database
```
[Database Query] SELECT * FROM users {
  duration: '45ms',
  rows: 150,
  timestamp: '2025-12-10T10:30:45.168Z'
}
```

### Performance
```
[Performance] 🚀 User fetch - 150ms {
  requestId: 'req_abc123',
  userCount: 150
}
```

### Response
```
[API Response] ✅ GET /api/users - 200 (150ms) {
  userId: 'user-123',
  requestId: 'req_abc123',
  timestamp: '2025-12-10T10:30:45.273Z'
}
```

## Environment Variables

| Variable | Values | Effect |
|----------|--------|--------|
| `NODE_ENV` | `development` | Enables dev logging |
| `NODE_ENV` | `production` | Disables dev logging |
| `LOG_LEVEL` | `verbose` | Enables debug/database logs |
| `LOG_LEVEL` | `debug` | Enables debug/database logs |
| `LOG_LEVEL` | (unset) | Normal logging only |

## Migration from console.log

### Before
```typescript
console.log('User authenticated:', user.id)
console.error('Database error:', error)
console.warn('Validation failed')
```

### After
```typescript
devLog.info('User authenticated', { userId: user.id })
devLog.error('Database error', error)
devLog.warn('Validation failed')
```

## Performance Icons

- 🚀 Fast (< 500ms)
- ⚡ Medium (500-1000ms)
- 🐌 Slow (> 1000ms)

## Status Emojis

- ✅ Success (2xx)
- ⚠️ Client Error (4xx)
- ❌ Server Error (5xx)

## Auth Emojis

- 🔓 Success
- 🔒 Failure

## Best Practices

1. ✅ Always track total duration
2. ✅ Use request IDs from headers
3. ✅ Log database query times
4. ✅ Log validation failures
5. ✅ Use structured metadata (objects)
6. ✅ Replace all console.* with devLog.*
7. ❌ Don't log sensitive data directly
8. ❌ Don't use string concatenation
9. ❌ Don't log in tight loops

## Files to Reference

- `/LOGGING_GUIDE.md` - Full documentation
- `/API_LOGGING_SUMMARY.md` - Implementation overview
- `/src/shared/utils/dev-logger.ts` - Source code
- `/src/app/api/user/dashboard/stats/route.ts` - Example
- `/src/app/api/quiz/sessions/route.ts` - Example
- `/src/app/api/admin/system-status/route.ts` - Example

---

**Print this and keep it handy while developing!**
