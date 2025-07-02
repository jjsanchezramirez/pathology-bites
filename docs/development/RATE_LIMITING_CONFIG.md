# Authentication Rate Limiting Configuration

## Overview

The authentication system includes configurable rate limiting to prevent brute force attacks while maintaining good user experience.

## Environment Variables

Add these to your `.env.local` file:

```bash
# Authentication Rate Limiting Configuration
AUTH_RATE_LIMIT_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_MINUTES=15
AUTH_RATE_LIMIT_BLOCK_MINUTES_DEV=2
AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD=10
```

## Configuration Options

### `AUTH_RATE_LIMIT_ATTEMPTS`
- **Default**: `5`
- **Description**: Number of failed login attempts allowed per window
- **Recommended**: 3-10 attempts

### `AUTH_RATE_LIMIT_WINDOW_MINUTES`
- **Default**: `15`
- **Description**: Time window for counting attempts (in minutes)
- **Recommended**: 10-30 minutes

### `AUTH_RATE_LIMIT_BLOCK_MINUTES_DEV`
- **Default**: `2`
- **Description**: Block duration in development environment (in minutes)
- **Recommended**: 1-5 minutes (for easier testing)

### `AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD`
- **Default**: `10`
- **Description**: Block duration in production environment (in minutes)
- **Recommended**: 5-60 minutes (balance security vs UX)

## Example Configurations

### Development (Lenient)
```bash
AUTH_RATE_LIMIT_ATTEMPTS=10
AUTH_RATE_LIMIT_WINDOW_MINUTES=15
AUTH_RATE_LIMIT_BLOCK_MINUTES_DEV=1
AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD=5
```

### Production (Balanced)
```bash
AUTH_RATE_LIMIT_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_MINUTES=15
AUTH_RATE_LIMIT_BLOCK_MINUTES_DEV=2
AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD=10
```

### High Security (Strict)
```bash
AUTH_RATE_LIMIT_ATTEMPTS=3
AUTH_RATE_LIMIT_WINDOW_MINUTES=10
AUTH_RATE_LIMIT_BLOCK_MINUTES_DEV=5
AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD=30
```

## Monitoring Rate Limits

### 1. Server Console Logs
Watch your development console for rate limit messages:
```
Login attempt from IP 192.168.0.106: 3/5 attempts
Rate limit exceeded for IP 192.168.0.106. Retry after: 2 minutes
```

### 2. Admin API Endpoint
Check current rate limit status (admin only):
```
GET /api/admin/rate-limit-status
```

Response:
```json
{
  "clientIP": "192.168.0.106",
  "currentAttempts": 3,
  "maxAttempts": 5,
  "isRateLimited": false,
  "retryAfterMs": 0,
  "retryAfterMinutes": 0,
  "windowMs": 900000,
  "windowMinutes": 15,
  "blockDurationMs": 120000,
  "blockMinutes": 2,
  "environment": "development",
  "config": {
    "maxAttempts": 5,
    "windowMinutes": 15,
    "blockMinutesDev": 2,
    "blockMinutesProd": 10,
    "currentBlockMinutes": 2
  }
}
```

## Testing Rate Limits

### Quick Test
1. Make 6 failed login attempts quickly
2. Should see rate limit message
3. Wait for block duration to expire
4. Verify normal login works again

### Reset Rate Limits (Development)
Restart the development server to clear all rate limit counters:
```bash
# Stop server (Ctrl+C) then restart
npm run dev
```

## Security Considerations

### IP-Based Limiting
- Rate limits are applied per IP address
- Users behind NAT/proxy may share limits
- Consider implementing user-based limits for better UX

### Bypass Prevention
- Rate limiting happens before Supabase authentication
- Blocked requests never reach the database
- Reduces server load and API costs

### Monitoring
- Monitor rate limit events in production
- Alert on unusual patterns
- Consider implementing CAPTCHA for repeated violations

## Troubleshooting

### Rate Limits Too Strict
- Increase `AUTH_RATE_LIMIT_ATTEMPTS`
- Decrease `AUTH_RATE_LIMIT_BLOCK_MINUTES_*`
- Consider user feedback

### Rate Limits Too Lenient
- Decrease `AUTH_RATE_LIMIT_ATTEMPTS`
- Increase `AUTH_RATE_LIMIT_BLOCK_MINUTES_*`
- Monitor for abuse patterns

### Development Testing Issues
- Use low block duration in development
- Restart server to reset counters
- Consider separate development configuration
