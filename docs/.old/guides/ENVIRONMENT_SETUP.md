# Environment Configuration Guide

## Overview

This guide explains how to set up environment variables for the Pathology Bites application across different environments.

## Quick Setup

### 1. Copy Environment Template
```bash
cp .env.example .env.local
```

### 2. Configure Required Variables
Edit `.env.local` and fill in these required values:

```bash
# Required: Get from Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Start Development
```bash
npm run dev
```

## Environment Files

### `.env.example`
- **Purpose**: Template and documentation
- **Version Control**: ✅ Committed to Git
- **Contains**: Example values and documentation
- **Security**: No sensitive data

### `.env.local`
- **Purpose**: Local development configuration
- **Version Control**: ❌ Never committed (in .gitignore)
- **Contains**: Your actual API keys and secrets
- **Security**: Contains sensitive data

### `.env.production` (Optional)
- **Purpose**: Production environment overrides
- **Version Control**: ❌ Never committed
- **Contains**: Production-specific values
- **Security**: Contains sensitive data

## Environment Variables Reference

### Application Settings
```bash
NODE_ENV=development                    # Environment mode
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Base URL for redirects
```

### Database & Backend (Required)
```bash
NEXT_PUBLIC_SUPABASE_URL=               # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=          # Public API key (safe for client)
SUPABASE_SERVICE_ROLE_KEY=              # Private API key (server only)
```

### Authentication & Security
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=           # Google OAuth client ID
AUTH_RATE_LIMIT_ATTEMPTS=5              # Failed login attempts allowed
AUTH_RATE_LIMIT_WINDOW_MINUTES=15       # Time window for rate limiting
AUTH_RATE_LIMIT_BLOCK_MINUTES_DEV=2     # Block duration (development)
AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD=10   # Block duration (production)
```

### External Services (Optional)
```bash
RESEND_API_KEY=                         # Email service API key
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=        # Analytics tracking ID
```

### Development & Debugging
```bash
DEBUG=false                             # Enable debug logging
```

## Getting API Keys

### Supabase Keys
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the **URL** and **anon/public** key
5. Copy the **service_role** key (keep this secret!)

### Google OAuth (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Create **OAuth 2.0 Client ID** credentials
5. Add your domain to authorized origins

### Resend Email (Optional)
1. Go to [Resend](https://resend.com)
2. Create an account
3. Navigate to **API Keys**
4. Create a new API key

## Environment-Specific Configuration

### Development
```bash
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_RATE_LIMIT_BLOCK_MINUTES_DEV=2     # Short blocks for testing
DEBUG=true                              # Enable debug logs
```

### Production
```bash
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD=10   # Longer blocks for security
DEBUG=false                             # Disable debug logs
```

### Testing
```bash
NODE_ENV=test
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Use test database URLs if available
```

## Security Best Practices

### ✅ Do
- Keep `.env.local` out of version control
- Use different keys for dev/staging/production
- Rotate API keys regularly
- Use environment-specific values
- Document all variables in `.env.example`

### ❌ Don't
- Commit `.env.local` or `.env.production`
- Share service role keys
- Use production keys in development
- Hardcode secrets in source code
- Expose server-only keys to client

## Troubleshooting

### Common Issues

#### "Supabase client not configured"
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Ensure variables start with `NEXT_PUBLIC_` for client access

#### "Authentication failed"
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check key permissions in Supabase dashboard

#### "Rate limiting not working"
- Restart development server after changing rate limit variables
- Check console logs for rate limit messages

#### "Environment variables not loading"
- Ensure file is named `.env.local` (not `.env.local.txt`)
- Restart development server after changes
- Check for syntax errors in environment file

### Validation Commands
```bash
# Check if environment variables are loaded
npm run dev

# Verify Supabase connection
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"
```

## File Structure
```
project-root/
├── .env.example          # Template (committed)
├── .env.local           # Development (ignored)
├── .env.production      # Production (ignored)
├── .gitignore           # Excludes .env files
└── docs/development/
    └── ENVIRONMENT_SETUP.md  # This file
```

For more information, see:
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Supabase Configuration](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Rate Limiting Configuration](./RATE_LIMITING_CONFIG.md)
