# Security Guide

This document outlines the security measures implemented in Pathology Bites and best practices for maintaining security.

## 🔒 Environment Security

### Environment Variable Validation

The application uses a comprehensive environment validation system located in `src/shared/utils/env-validation.ts`.

#### Required Environment Variables

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://your-domain.com  # Optional, defaults to Supabase URL

# Optional Services
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
RESEND_API_KEY=your-resend-api-key
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id
```

#### Validation Features

- **Automatic Validation**: Environment variables are validated on application startup
- **Type Safety**: Uses Zod schema validation for type checking
- **Error Messages**: Clear error messages for missing or invalid variables
- **Runtime Checks**: Separate validation for client-side and server-side environments

#### Usage Example

```typescript
import { validateClientEnv, validateServerEnv } from '@/shared/utils/env-validation'

// Client-side validation
const clientConfig = validateClientEnv()

// Server-side validation  
const serverConfig = validateServerEnv()
```

## 🛡️ API Rate Limiting

### Rate Limiting Implementation

API rate limiting is implemented using `src/shared/utils/api-rate-limiter.ts` to prevent abuse and ensure fair usage.

#### Rate Limit Configurations

- **Authentication Endpoints**: 10 requests per 15 minutes
- **General API Endpoints**: 100 requests per minute
- **Admin API Endpoints**: 200 requests per minute (higher limit)
- **Quiz API Endpoints**: 50 requests per minute

#### Usage in API Routes

```typescript
import { withRateLimit, authRateLimiter } from '@/shared/utils/api-rate-limiter'

const rateLimitedHandler = withRateLimit(authRateLimiter)

export const POST = rateLimitedHandler(async function(request: NextRequest) {
  // Your API logic here
})
```

#### Rate Limit Headers

All API responses include rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets
- `Retry-After`: Seconds to wait before retrying (when rate limited)

## 🔐 Authentication Security

### Supabase Authentication

- **Row Level Security (RLS)**: All database tables use RLS policies
- **JWT Validation**: Automatic token validation and refresh
- **Session Management**: Secure session handling with automatic cleanup
- **OAuth Integration**: Google OAuth with secure token exchange

### Password Requirements

Enforced through Supabase Auth configuration:
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character

## 🗄️ Database Security

### Row Level Security Policies

All tables implement RLS policies to ensure users can only access authorized data:

```sql
-- Example: Users can only see their own quiz sessions
CREATE POLICY "Users can view own quiz sessions" ON quiz_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Example: Only admins can manage questions
CREATE POLICY "Admins can manage questions" ON questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'reviewer')
    )
  );
```

### Data Validation

- **Database Constraints**: Foreign key constraints and check constraints
- **Application Validation**: Zod schemas for all form inputs
- **Type Safety**: Full TypeScript coverage for database operations

## 🌐 Network Security

### HTTPS Enforcement

- **Production**: All traffic encrypted with HTTPS
- **Development**: Local development uses HTTP (secure for local testing)
- **Headers**: Security headers configured in Next.js

### CORS Configuration

- **Supabase**: CORS configured for application domain only
- **API Routes**: Proper CORS headers for cross-origin requests

## 🔍 Security Monitoring

### Error Handling

- **No Sensitive Data**: Error messages never expose sensitive information
- **Logging**: Security events logged for monitoring
- **Rate Limiting**: Automatic blocking of suspicious activity

### Security Headers

Configured in `next.config.ts`:
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

## 🚨 Security Incident Response

### If You Suspect a Security Issue

1. **Do Not** commit sensitive information to version control
2. **Immediately** rotate any exposed API keys or secrets
3. **Update** environment variables in production
4. **Review** access logs for suspicious activity
5. **Document** the incident and remediation steps

### Regular Security Maintenance

- **Monthly**: Review and rotate API keys
- **Quarterly**: Audit user permissions and roles
- **Annually**: Security assessment and penetration testing

## 📋 Security Checklist

### Development
- [ ] Never commit `.env.local` or `.env.production`
- [ ] Use environment validation in all new features
- [ ] Implement rate limiting for new API endpoints
- [ ] Test authentication flows thoroughly

### Deployment
- [ ] Verify all environment variables are set
- [ ] Confirm HTTPS is enabled
- [ ] Test rate limiting in production
- [ ] Verify RLS policies are active

### Monitoring
- [ ] Monitor rate limit violations
- [ ] Review authentication errors
- [ ] Check for unusual database activity
- [ ] Validate security headers are present

## 🔗 Related Documentation

- [Developer Setup Guide](DEVELOPER_SETUP.md) - Environment configuration
- [API Documentation](../features/api-documentation.md) - API security details
- [Database Schema](../features/database-schema.md) - RLS policy details
