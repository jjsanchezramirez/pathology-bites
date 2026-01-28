# R2 Signed URLs - Work in Progress

⚠️ **NOT CURRENTLY USED** ⚠️

## What This Is

Infrastructure code for generating temporary signed URLs to access private content stored in Cloudflare R2.

## Why It's Not Used

All R2 content in this application is intentionally **public** because:

1. **Simplicity** - No API calls, no token management, direct URLs
2. **Performance** - Browsers fetch directly from Cloudflare CDN, bypassing Vercel
3. **Cost** - Zero Vercel bandwidth usage, minimal function invocations
4. **Caching** - Cloudflare's global CDN handles it automatically
5. **Content Type** - All stored content is educational resources (slides, images, JSON data) with no sensitive information

## When You Would Use This

Only implement this if you need to:
- Store user-uploaded private content
- Restrict access to specific files based on authentication/authorization
- Implement time-limited access to resources
- Comply with privacy requirements for sensitive data

## What's Included

### Utilities (`utils/`)
- `r2-signed-urls.ts` - Core signing logic using AWS SDK
  - Server-side: `generateSignedUrl()`, `generateBatchSignedUrls()`, `signedUrlApi`
  - Client-side: `clientSignedUrls.get()`, `clientSignedUrls.getBatch()`
  - Caching: `SignedUrlCache` class for client-side URL caching

### API Routes (`api/routes/`)
- `signed-url-route.ts` - Single URL generation (POST + GET methods)
  - Originally at: `/api/r2/signed-url`
- `signed-urls-batch-route.ts` - Batch URL generation (up to 100 URLs)
  - Originally at: `/api/r2/signed-urls/batch`

## How It Works

1. Client requests signed URL from API route
2. Server generates time-limited URL using AWS S3 presigner
3. Client caches URL until near expiration
4. Client uses URL to fetch content directly from R2
5. URL expires after configured time (default 1 hour)

## Reintegrating This Code

If you decide to use private R2 content:

1. Move files back to their original locations:
   - `utils/r2-signed-urls.ts` → `src/shared/utils/`
   - `api/routes/*` → `src/app/api/r2/signed-url/` and `src/app/api/r2/signed-urls/batch/`

2. Update import paths in the route files

3. Configure R2 bucket permissions to private

4. Replace direct R2 URLs in your code with signed URL requests:
   ```typescript
   // Before (public)
   const url = "https://pub-xxx.r2.dev/images/slide.jpg"

   // After (private)
   const url = await clientSignedUrls.get("images/slide.jpg")
   ```

5. Add error handling for expired/invalid URLs

## Environment Variables Needed

Already configured:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## Reference

Original implementation date: October 2024
Moved to WIP: January 2025
Git history preserved for future reference
