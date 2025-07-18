# Vercel Deployment Guide for Pathology Bites

This guide covers deploying Pathology Bites to Vercel with proper environment variable configuration.

## 🚀 Quick Deployment Steps

### 1. Connect Repository to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository: `jjsanchezramirez/pathology-bites`
4. Configure project settings (see below)

### 2. Environment Variables Setup

In your Vercel project settings, add these environment variables:

#### **Required Variables**
```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://pathologybites.com
NEXT_PUBLIC_COMING_SOON_MODE=false

# Database
NEXT_PUBLIC_SUPABASE_URL=https://htsnkuudinrcgfqlqmpi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c25rdXVkaW5yY2dmcWxxbXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc3NDUyMjUsImV4cCI6MjA1MzMyMTIyNX0.MXeattLkrBXxAAPqDvm9t-Q1vXFT1Thru7csraMjOdI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c25rdXVkaW5yY2dmcWxxbXBpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzc0NTIyNSwiZXhwIjoyMDUzMzIxMjI1fQ.jsQPNljL4-Qj-fhNpSggQeMnL3teFLW7dXMhW5S2zkE

# SEO & Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-MF54VRGQVB
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=

# Authentication
NEXT_PUBLIC_GOOGLE_CLIENT_ID=673736604603-4un1etirrnts8tboj4e2negvaelcrdmb.apps.googleusercontent.com
```

#### **Optional Variables**
```bash
# External Services
RESEND_API_KEY=re_3W6bswET_DuW9pVkDjwtJ7ap53Z7ixatD

# Rate Limiting
AUTH_RATE_LIMIT_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_MINUTES=15
AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD=10

# Quiz Configuration
NEXT_PUBLIC_MAX_QUESTIONS_PER_QUIZ=50
NEXT_PUBLIC_MIN_QUESTIONS_PER_QUIZ=5
NEXT_PUBLIC_MAX_QUIZZES_PER_DAY=50
NEXT_PUBLIC_MAX_QUESTIONS_PER_DAY=100
NEXT_PUBLIC_SECONDS_PER_QUESTION=60
NEXT_PUBLIC_AUTO_SUBMIT_QUIZ=true
NEXT_PUBLIC_SHOW_QUIZ_PROGRESS=true

# UI/UX Settings
NEXT_PUBLIC_MIN_TEXT_ZOOM_SIZE=0.75
NEXT_PUBLIC_MAX_TEXT_ZOOM_SIZE=1.25
NEXT_PUBLIC_DEFAULT_TEXT_ZOOM_SIZE=1.0
NEXT_PUBLIC_TEXT_ZOOM_STEP=0.05
NEXT_PUBLIC_DEFAULT_THEME=default
NEXT_PUBLIC_THEME_SWITCHING_ENABLED=true
NEXT_PUBLIC_SYSTEM_THEME_DETECTION=true
NEXT_PUBLIC_ITEMS_PER_PAGE=20
NEXT_PUBLIC_MAX_ITEMS_PER_PAGE=100
NEXT_PUBLIC_ENABLE_ANIMATIONS=true
NEXT_PUBLIC_COMPACT_MODE_AVAILABLE=true
```

### 3. Build Settings
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`

### 4. Domain Configuration
1. Add your custom domain: `pathologybites.com`
2. Configure DNS records as instructed by Vercel
3. Enable HTTPS (automatic with Vercel)

## 🔧 Post-Deployment Setup

### 1. Google Search Console
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://pathologybites.com`
3. Verify ownership using HTML tag method
4. Copy verification code to `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
5. Redeploy to apply the verification

### 2. Submit Sitemap
1. In Google Search Console, go to Sitemaps
2. Submit: `https://pathologybites.com/sitemap.xml`
3. Monitor indexing status

### 3. Analytics Verification
1. Visit your deployed site
2. Check Google Analytics Real-time reports
3. Verify events are being tracked

## 📊 Monitoring & Maintenance

### Key URLs to Monitor
- **Site**: https://pathologybites.com
- **Sitemap**: https://pathologybites.com/sitemap.xml
- **Robots**: https://pathologybites.com/robots.txt
- **Manifest**: https://pathologybites.com/manifest.json

### Performance Checks
- **Vercel Analytics**: Monitor Core Web Vitals
- **Google PageSpeed Insights**: Test performance
- **Google Search Console**: Monitor search performance
- **Google Analytics**: Track user engagement

## 🚨 Important Notes

### Security
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- Keep all API keys secure and rotate regularly
- Use environment-specific keys for dev/staging/production

### SEO
- Ensure `NEXT_PUBLIC_SITE_URL` matches your actual domain
- Set `NEXT_PUBLIC_COMING_SOON_MODE=false` for production
- Verify all meta tags and Open Graph images are working

### Performance
- Monitor build times and bundle sizes
- Check Core Web Vitals regularly
- Optimize images and lazy loading

## 🔄 Deployment Workflow

### Automatic Deployments
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and feature branches
- **Development**: Local development with `npm run dev`

### Manual Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Deploy preview
vercel
```

## 📈 Success Metrics

After deployment, verify:
- [ ] Site loads correctly at your domain
- [ ] Google Analytics is tracking visitors
- [ ] Search Console shows no crawl errors
- [ ] Sitemap is accessible and valid
- [ ] All environment variables are working
- [ ] Database connections are successful
- [ ] Authentication flows work properly
- [ ] SEO meta tags are displaying correctly

## 🆘 Troubleshooting

### Common Issues
1. **Build Failures**: Check environment variables and dependencies
2. **Database Errors**: Verify Supabase credentials and RLS policies
3. **Analytics Not Working**: Confirm GA measurement ID is correct
4. **SEO Issues**: Check meta tags and sitemap generation

### Support Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)

---

**Status**: Ready for production deployment with comprehensive SEO and analytics
