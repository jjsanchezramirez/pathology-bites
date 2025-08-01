# Egress Optimization Plan

## 🎯 **Goal: Reduce Supabase Egress from 0.928GB to <0.2GB**

## 📊 **Current Analysis**

### Storage Usage
- **Total Images**: 85 images (43.5 MB)
- **Orphaned Images**: 57 images (29.8 MB) - **68.5% waste**
- **Used Images**: 28 images (13.7 MB)
- **Questions with Images**: 12/19 (63%)

### Egress Sources
1. **Orphaned Images**: 67% of images are unused but still accessible
2. **Large Image Sizes**: Average 512KB, max 970KB
3. **Unoptimized Formats**: No compression or resizing
4. **Direct Supabase Storage**: All images served from Supabase

## 🚀 **Optimization Strategy**

### Phase 1: Immediate Cleanup (90% egress reduction)
1. **Delete Orphaned Images** - Remove 57 unused images (29.8 MB)
2. **Audit Image Usage** - Verify which images are actually needed
3. **Clean Storage Paths** - Remove broken or duplicate references

### Phase 2: Image Optimization (50% size reduction)
1. **Compress Images** - Reduce file sizes by 50-70%
2. **Resize Images** - Optimize dimensions for web display
3. **Format Optimization** - Convert to WebP where supported

### Phase 3: External CDN Migration (95% egress reduction)
1. **Free CDN Options**:
   - **Cloudinary** (25GB free, 25GB bandwidth)
   - **ImageKit** (20GB free, 20GB bandwidth)
   - **Uploadcare** (3GB free, unlimited bandwidth)
   - **Cloudflare Images** (100k images free)

2. **Implementation**:
   - Migrate optimized images to external CDN
   - Update image URLs in database
   - Keep Supabase for metadata only

### Phase 4: Smart Loading (Additional savings)
1. **Lazy Loading** - Load images only when visible
2. **Progressive Images** - Load low-res first, then high-res
3. **Caching Strategy** - Browser and CDN caching

## 📋 **Implementation Plan**

### Step 1: Orphaned Image Cleanup
```sql
-- Identify orphaned images
SELECT i.id, i.url, i.file_size_bytes 
FROM images i 
LEFT JOIN question_images qi ON i.id = qi.image_id 
WHERE qi.image_id IS NULL;

-- Delete orphaned images (after backup)
DELETE FROM images 
WHERE id IN (
  SELECT i.id FROM images i 
  LEFT JOIN question_images qi ON i.id = qi.image_id 
  WHERE qi.image_id IS NULL
);
```

### Step 2: Image Optimization Script
```typescript
// Compress and resize images
const optimizeImage = async (imageUrl: string) => {
  // Download image
  // Compress using sharp or similar
  // Resize to max 1200px width
  // Convert to WebP if supported
  // Upload to CDN
  // Update database URL
}
```

### Step 3: CDN Migration
```typescript
// Update image URLs to use CDN
const migrateImageToCDN = async (imageId: string) => {
  const optimizedUrl = await uploadToCloudinary(imageId)
  await supabase
    .from('images')
    .update({ url: optimizedUrl })
    .eq('id', imageId)
}
```

## 🎯 **Expected Results**

### Immediate Impact (Phase 1)
- **Storage Reduction**: 29.8 MB → 13.7 MB (68% reduction)
- **Egress Reduction**: ~0.6 GB → ~0.2 GB (67% reduction)
- **Cost Savings**: Significant reduction in Supabase egress charges

### Long-term Impact (All Phases)
- **Storage**: 43.5 MB → ~7 MB (84% reduction)
- **Egress**: 0.928 GB → <0.05 GB (95% reduction)
- **Performance**: Faster image loading with CDN
- **Scalability**: Room for growth without egress concerns

## 🛠 **Tools Needed**

1. **Image Optimization**: Sharp.js or similar
2. **CDN Service**: Cloudinary (recommended for free tier)
3. **Migration Scripts**: Custom TypeScript utilities
4. **Monitoring**: Track egress usage post-migration

## ⚠ **Risks & Mitigation**

1. **Data Loss**: Backup all images before deletion
2. **Broken Links**: Test all image URLs after migration
3. **CDN Limits**: Monitor usage against free tier limits
4. **Performance**: Test image loading speeds

## 📅 **Timeline**

- **Week 1**: Orphaned image cleanup (immediate 67% reduction)
- **Week 2**: Image optimization and compression
- **Week 3**: CDN migration setup and testing
- **Week 4**: Full migration and monitoring

## 🔍 **Monitoring**

Track these metrics:
- Supabase egress usage (daily)
- CDN bandwidth usage
- Image loading performance
- Storage costs
