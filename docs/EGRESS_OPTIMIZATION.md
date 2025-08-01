# Egress Optimization Guide

## 🎯 **Objective**
Reduce Supabase egress usage from **0.928GB to <0.2GB** (78% reduction) by optimizing image storage and delivery.

## 📊 **Current Analysis**

### Storage Breakdown
- **Total Images**: 85 images (43.5 MB)
- **Orphaned Images**: 57 images (29.8 MB) - **68.5% waste** 🚨
- **Active Images**: 28 images (13.7 MB)
- **Questions with Images**: 12/19 (63%)

### Egress Sources
1. **Orphaned Images** (67%) - Unused images still accessible and counted toward egress
2. **Large File Sizes** (512KB average) - Unoptimized images
3. **Direct Supabase Serving** (100%) - All images served from Supabase storage

## 🚀 **3-Phase Optimization Strategy**

### Phase 1: Immediate Cleanup (67% reduction)
**Goal**: Remove orphaned images to eliminate wasted egress

```bash
# 1. Analyze current usage (dry run)
npm run cleanup-images

# 2. Create backup and delete orphaned images
npm run cleanup-images:force
```

**Expected Impact**: 29.8 MB storage reduction, ~67% egress reduction

### Phase 2: Image Optimization (50% size reduction)
**Goal**: Compress and resize images for web delivery

```bash
# 1. Set up CDN credentials (see setup section below)
# 2. Test migration (dry run)
npm run migrate-cdn

# 3. Perform actual migration
npm run migrate-cdn:live
```

**Expected Impact**: 50-70% file size reduction, faster loading

### Phase 3: External CDN Migration (95% egress reduction)
**Goal**: Move images to external CDN to eliminate Supabase egress

**Recommended CDN**: Cloudinary (25GB free, 25GB bandwidth)

## 🛠 **Setup Instructions**

### 1. Install Dependencies
```bash
npm install sharp cloudinary tsx node-fetch
npm install --save-dev @types/node-fetch @types/sharp
```

### 2. Configure CDN Provider

#### Option A: Cloudinary (Recommended)
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Get your credentials from the dashboard
3. Add to `.env.local`:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### Option B: ImageKit (Alternative)
1. Sign up at [imagekit.io](https://imagekit.io)
2. Add to `.env.local`:
```env
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=your_url_endpoint
```

### 3. Run Optimization Scripts

#### Step 1: Clean Orphaned Images
```bash
# Analyze what will be deleted
npm run cleanup-images

# Actually delete orphaned images (creates backup)
npm run cleanup-images:force
```

#### Step 2: Migrate to CDN
```bash
# Test migration (no changes made)
npm run migrate-cdn

# Perform actual migration
npm run migrate-cdn:live
```

## 📋 **Script Details**

### cleanup-orphaned-images.ts
- **Purpose**: Remove unused images from Supabase storage
- **Safety**: Creates backup before deletion
- **Impact**: ~67% egress reduction immediately

**Features**:
- Identifies images not referenced by any questions
- Creates JSON backup of deleted image metadata
- Removes from both database and storage
- Detailed logging and error handling

### migrate-images-to-cdn.ts
- **Purpose**: Optimize and migrate images to external CDN
- **Safety**: Creates URL backup before migration
- **Impact**: ~95% egress reduction + faster loading

**Features**:
- Downloads and optimizes images (compression, resizing)
- Uploads to CDN with automatic format optimization
- Updates database URLs to point to CDN
- Maintains image metadata and categories

## 🎯 **Expected Results**

### Immediate (Phase 1)
- **Storage**: 43.5 MB → 13.7 MB (68% reduction)
- **Egress**: 0.928 GB → 0.3 GB (67% reduction)
- **Time**: ~5 minutes

### Complete (All Phases)
- **Storage**: 43.5 MB → ~7 MB (84% reduction)
- **Egress**: 0.928 GB → <0.05 GB (95% reduction)
- **Performance**: Faster image loading via CDN
- **Scalability**: Room for growth without egress concerns

## 🔍 **Monitoring & Verification**

### Check Egress Usage
1. **Supabase Dashboard**: Monitor egress metrics
2. **CDN Dashboard**: Track bandwidth usage
3. **Application**: Verify image loading performance

### Verify Migration Success
```bash
# Check database for CDN URLs
npm run cleanup-images  # Should show 0 orphaned images

# Test image loading in application
# All images should load from CDN URLs
```

## ⚠ **Safety Measures**

### Backups Created
- **Image Metadata**: JSON backup of all image records
- **URL Mapping**: Backup of original URLs before CDN migration
- **Storage Paths**: Complete storage path information

### Rollback Process
If issues occur, you can rollback by:
1. Restoring URLs from backup files
2. Re-uploading images to Supabase if needed
3. Using backup metadata to recreate records

### Testing Checklist
- [ ] All images load correctly in application
- [ ] No broken image links
- [ ] CDN URLs are accessible
- [ ] Image quality is acceptable
- [ ] Loading performance improved

## 💰 **Cost Analysis**

### Current Supabase Costs
- **Egress**: 0.928/5 GB (18.6% of free tier)
- **Storage**: 0.034/0.5 GB (6.8% of free tier)

### Post-Optimization
- **Egress**: <0.05/5 GB (<1% of free tier)
- **Storage**: <0.01/0.5 GB (<2% of free tier)
- **CDN**: Free tier sufficient for current usage

### Long-term Benefits
- **Scalability**: Can handle 100x more traffic without egress issues
- **Performance**: Faster global image delivery
- **Reliability**: CDN redundancy and uptime
- **Cost Predictability**: Fixed CDN costs vs. variable egress

## 🔧 **Troubleshooting**

### Common Issues
1. **CDN Authentication**: Verify API keys are correct
2. **Image Format**: Some images may need manual conversion
3. **Large Images**: May hit CDN upload limits (resize first)
4. **Network Issues**: Retry failed uploads

### Debug Commands
```bash
# Check image usage
npm run cleanup-images

# Test CDN connection
npm run migrate-cdn --dry-run

# View detailed logs
DEBUG=true npm run migrate-cdn:live
```

## 📞 **Support**

If you encounter issues:
1. Check the backup files in `./backups/`
2. Review error logs in console output
3. Verify CDN credentials and quotas
4. Test with a small subset of images first
