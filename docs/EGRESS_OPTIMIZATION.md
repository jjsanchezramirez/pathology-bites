# Cloudflare Images Migration Guide

## 🎯 **Objective**
**ELIMINATE** Supabase egress charges by migrating images to Cloudflare Images (unlimited bandwidth, no egress fees).

## 📊 **Current Egress Analysis**

### Image Egress Breakdown
- **Total Images**: 85 images (41 MB storage)
- **Active Images**: 28 images used in questions
- **Estimated Monthly Egress**: ~548 MB
  - Microscopic images: 481 MB (88% of egress)
  - Figure images: 34 MB (6% of egress)
  - Table images: 33 MB (6% of egress)

### Root Cause
Images are loaded repeatedly during quiz sessions. With current quiz activity, each image generates significant egress.

## ☁️ **Cloudflare Images Solution**

### Why Cloudflare Images?
- **🆓 100k images free** (we have 85)
- **🚀 Unlimited bandwidth** (no egress charges ever!)
- **⚡ Automatic optimization** (WebP/AVIF conversion)
- **🌍 Global CDN** (faster than Supabase Storage)
- **🔧 On-demand resizing** via URL parameters
- **💰 $0 cost** for our current usage

### Migration Strategy
**Single-phase migration** - Move all active images to Cloudflare Images

```bash
# 1. Test migration (dry run)
npm run migrate-cloudflare

# 2. Perform actual migration
npm run migrate-cloudflare:live
```

**Expected Impact**:
- **100% egress elimination** for images
- **Faster loading** via global CDN
- **Automatic optimization** (WebP/AVIF)
- **Future-proof scaling** (no bandwidth limits)

## 🛠 **Setup Instructions**

### 1. Install Dependencies
```bash
npm install tsx node-fetch
npm install --save-dev @types/node-fetch
```

### 2. Configure Cloudflare Images

#### Step 1: Create Cloudflare Account
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Go to **Images** in the dashboard
3. Enable Cloudflare Images (free tier)

#### Step 2: Get API Credentials
1. Go to **My Profile** → **API Tokens**
2. Create token with **Cloudflare Images:Edit** permissions
3. Note your **Account ID** from the dashboard

#### Step 3: Configure Environment
Add to `.env.local`:
```env
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_IMAGES_DOMAIN=your_custom_domain_optional
```

### 3. Run Migration

#### Test Migration (Dry Run)
```bash
npm run migrate-cloudflare
```

#### Perform Actual Migration
```bash
npm run migrate-cloudflare:live
```

## 📋 **Migration Script Details**

### migrate-images-to-cdn.ts
- **Purpose**: Migrate images from Supabase Storage to Cloudflare Images
- **Safety**: Creates URL backup before migration
- **Impact**: 100% egress elimination for images

**Features**:
- Downloads images from Supabase Storage
- Uploads to Cloudflare Images (automatic optimization)
- Updates database URLs to Cloudflare URLs
- Maintains image metadata and categories
- No image processing needed (Cloudflare handles optimization)

## 🎯 **Expected Results**

### After Migration
- **Egress**: 548 MB/month → 0 MB/month (100% elimination)
- **Performance**: Faster loading via global CDN
- **Optimization**: Automatic WebP/AVIF conversion
- **Scalability**: Unlimited bandwidth for future growth
- **Cost**: $0 (free tier covers our usage)

## 🔍 **Monitoring & Verification**

### Check Migration Success
1. **Supabase Dashboard**: Monitor egress metrics (should drop to near zero)
2. **Cloudflare Dashboard**: View image delivery stats
3. **Application**: Verify all images load from Cloudflare URLs

### Verify Migration
```bash
# Test migration first
npm run migrate-cloudflare

# Check application - all images should load correctly
# URLs should be: https://imagedelivery.net/[account-id]/[image-id]/public
```

## ⚠ **Safety Measures**

### Automatic Backups
- **URL Backup**: JSON file with original Supabase URLs
- **Database Backup**: Complete image metadata preserved
- **Rollback Ready**: Can restore original URLs if needed

### Testing Checklist
- [ ] All images load correctly in application
- [ ] No broken image links
- [ ] Cloudflare URLs are accessible
- [ ] Image quality maintained (automatic optimization)
- [ ] Loading performance improved

## 💰 **Cost Impact**

### Current Supabase Usage
- **Egress**: ~548 MB/month from images
- **Storage**: 41 MB (will remain)

### After Cloudflare Migration
- **Image Egress**: 0 MB/month (eliminated)
- **Cloudflare Cost**: $0 (free tier: 100k images)
- **Supabase Savings**: Significant egress reduction

### Long-term Benefits
- **Unlimited Scaling**: No bandwidth limits ever
- **Global Performance**: Faster image delivery worldwide
- **Automatic Optimization**: WebP/AVIF conversion
- **Cost Predictability**: No surprise egress charges

## 🔧 **Troubleshooting**

### Common Issues
1. **Authentication**: Verify Cloudflare Account ID and API Token
2. **Permissions**: Ensure API token has Cloudflare Images:Edit permissions
3. **Network**: Check internet connection for uploads
4. **Quotas**: Verify within 100k image limit (we use 85)

### Debug Commands
```bash
# Test migration (dry run)
npm run migrate-cloudflare

# Check migration logs
# Review console output for detailed error messages

# Verify Cloudflare setup
# Check dashboard at dash.cloudflare.com → Images
```

## 📞 **Support**

If you encounter issues:
1. Check backup files in `./backups/`
2. Review error logs in console output
3. Verify Cloudflare credentials in dashboard
4. Test with dry run first: `npm run migrate-cloudflare`

## 🚀 **Next Steps**

After successful image migration, consider analyzing other egress sources:
- Database API calls (PostgREST)
- Authentication requests
- Realtime subscriptions
- Edge Functions (if any)

Images are the primary egress source (~548MB/month), so this migration should solve the immediate problem.
