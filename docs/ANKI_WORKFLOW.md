# Anki Deck Export and Upload Workflow

## Overview

This document describes the complete workflow for exporting Anki decks to JSON format, processing media files, and uploading them to Cloudflare R2 for use in the Pathology Bites Anki viewer.

**Last Updated:** December 21, 2025

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Export from Anki](#export-from-anki)
3. [File Organization](#file-organization)
4. [Image Compression and Upload](#image-compression-and-upload)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Anki Desktop** (latest version)
- **CrowdAnki Add-on** for Anki
  - Install from: Tools → Add-ons → Get Add-ons
  - Code: `1788670778`
  - [CrowdAnki GitHub](https://github.com/Stvad/CrowdAnki)

### Project Setup

```bash
# Ensure you're in the project root
cd /path/to/pathology-bites

# Create anki directory structure
mkdir -p anki/media
```

---

## Export from Anki

### Step 1: Install CrowdAnki

1. Open Anki Desktop
2. Go to **Tools → Add-ons → Get Add-ons**
3. Enter code: `1788670778`
4. Restart Anki

### Step 2: Export Your Deck

1. In Anki, select your deck (e.g., "Ankoma")
2. Go to **File → CrowdAnki: Export**
3. Configure export settings:
   - ✅ Include media files
   - ✅ Include scheduling information (optional)
   - ✅ Export subdeck structure
4. Choose export location: `/path/to/pathology-bites/anki/`
5. Click **Export**

### Step 3: Verify Export

After export, you should have:

```
anki/
├── deck.json           # Main deck structure
├── media_files/        # All images, SVGs, etc.
│   ├── image1.png
│   ├── image2.jpg
│   └── ...
└── media               # May be named 'media' instead of 'media_files'
    └── ...
```

**Note:** CrowdAnki may create either `media/` or `media_files/`. The upload script expects `media/`.

### Step 4: Prepare Files

```bash
# If CrowdAnki created 'media_files', rename it
cd anki
mv media_files media  # if needed

# Rename deck.json to ankoma.json (or your deck name)
mv deck.json ankoma.json
```

Your structure should now be:

```
anki/
├── ankoma.json
└── media/
    ├── paste-123.png
    ├── image-456.jpg
    └── ...
```

---

## File Organization

### CrowdAnki JSON Structure

The exported `ankoma.json` follows this structure:

```json
{
  "__type__": "Deck",
  "name": "Ankoma",
  "crowdanki_uuid": "...",
  "children": [
    {
      "__type__": "Deck",
      "name": "Ankoma - AP",
      "children": [
        {
          "__type__": "Deck",
          "name": "Basic Principles",
          "notes": [
            {
              "__type__": "Note",
              "guid": "...",
              "note_model_uuid": "...",
              "fields": ["Header", "{{c1::Text}}", "Extra", ...],
              "tags": ["pathology", "basics"]
            }
          ]
        }
      ]
    }
  ]
}
```

### Media File Naming

CrowdAnki exports media with original Anki filenames:
- Pattern: `paste-<number>.<ext>` or `<original-name>.<ext>`
- Supported formats: `.png`, `.jpg`, `.jpeg`, `.svg`, `.gif`, `.jpglarge`, `.png_m`
- Files are referenced in card HTML by exact filename

**Important:** Do not rename media files - the JSON references them by exact filename.

---

## Image Compression and Upload

### Why Compress During Upload?

The upload script compresses images **during upload** rather than locally because:

1. **Version Control**: Keep original high-quality images in `anki/media/` (git-ignored)
2. **Flexibility**: Easy to adjust compression settings without re-exporting
3. **Automation**: One-step process from export to production
4. **Quality Testing**: Can compare original vs compressed easily

### Compression Settings

The upload script uses **Sharp** with these settings:

```typescript
// For JPEG/JPG
{
  quality: 85,          // Aggressive but maintains quality
  progressive: true,    // Progressive loading
  mozjpeg: true        // Better compression
}

// For PNG
{
  quality: 85,
  compressionLevel: 9,  // Maximum compression
  progressive: true
}

// For all images
{
  maxWidth: 2400,       // Resize very large images
  maxHeight: 2400,
  fit: 'inside',        // Maintain aspect ratio
  withoutEnlargement: true  // Don't upscale small images
}
```

### Upload Process

#### Step 1: Preview Files

Check what will be uploaded:

```bash
curl http://localhost:3000/api/media/r2/upload-anki-media | jq .
```

Response shows:
- Total files found
- Total size (before compression)
- First 20 files as preview
- Estimated compression savings

#### Step 2: Start Upload

```bash
curl -X POST http://localhost:3000/api/media/r2/upload-anki-media | jq .
```

The script will:
1. Read each file from `anki/media/`
2. Compress using Sharp with aggressive settings
3. Upload to R2: `pathology-bites-images/anki/<filename>`
4. **Replace** existing files (if any) with same name
5. Log progress every 50 files
6. Return summary with upload stats

#### Step 3: Upload JSON

The `ankoma.json` file needs to be uploaded separately to R2:

```bash
# Using wrangler CLI (recommended)
wrangler r2 object put pathology-bites-images/anki/ankoma.json \
  --file=anki/ankoma.json \
  --content-type="application/json"

# Or use the Cloudflare Dashboard
# Navigate to R2 → pathology-bites-images → Upload
```

### Upload Response

```json
{
  "success": true,
  "totalFiles": 1247,
  "uploadedFiles": 1247,
  "failedFiles": 0,
  "totalSize": 45234567,        // Before compression
  "uploadedSize": 12345678,     // After compression (73% savings)
  "compressionRatio": 0.27,
  "results": [
    {
      "filename": "paste-123.png",
      "success": true,
      "url": "https://pub-xxx.r2.dev/anki/paste-123.png",
      "size": 45678,              // Compressed size
      "originalSize": 234567,     // Original size
      "compressionRatio": 0.19,   // 81% reduction
      "r2Key": "anki/paste-123.png"
    }
  ]
}
```

---

## Verification

### Check Upload Success

```bash
# View upload summary
curl http://localhost:3000/api/media/r2/upload-anki-media | jq '.message'

# Check specific file
curl https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/anki/paste-123.png \
  -I  # Should return 200 OK
```

### Test in Application

1. Start dev server: `npm run dev`
2. Navigate to `/dashboard/anki`
3. Verify:
   - Deck loads successfully
   - Images display correctly
   - No broken image links
   - Image quality is acceptable
   - Page load speed is good

### Quality Check

Compare original vs compressed:

```bash
# Original (local)
ls -lh anki/media/paste-123.png

# Compressed (R2)
curl https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/anki/paste-123.png \
  --output /tmp/paste-123-compressed.png
ls -lh /tmp/paste-123-compressed.png

# Visual comparison
open anki/media/paste-123.png
open /tmp/paste-123-compressed.png
```

---

## Troubleshooting

### Common Issues

#### Issue: "Anki media directory not found"

**Solution:**
```bash
# Ensure directory exists
mkdir -p anki/media

# Check path
ls -la anki/media
```

#### Issue: Upload fails with "out of memory"

**Cause:** Processing too many large images at once

**Solution:** The script processes files sequentially to avoid memory issues. If still occurring:
- Restart the server
- Process in smaller batches
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096" npm run dev`

#### Issue: Images look blurry

**Cause:** Compression too aggressive or max dimensions too small

**Solution:** Adjust settings in `upload-anki-media/route.ts`:
```typescript
quality: 90,  // Increase from 85
maxWidth: 3200,  // Increase from 2400
```

#### Issue: Some images not uploading

**Check:**
```bash
# Check file extensions
ls anki/media/ | grep -v '\(png\|jpg\|jpeg\|svg\|gif\)$'

# Check for unusual filenames
ls anki/media/ | grep '[^a-zA-Z0-9._-]'
```

**Solution:** Add unsupported extensions to `SUPPORTED_EXTENSIONS` array

#### Issue: Files uploading but not displaying

**Causes:**
1. Incorrect R2 public URL
2. CORS configuration
3. Filename mismatch

**Solution:**
```bash
# Verify R2 URL in config
grep ANKOMA_JSON_URL src/shared/config/ankoma.ts

# Check CORS settings in R2 dashboard
# Should allow GET from your domain
```

---

## Updating an Existing Deck

### When to Update

- Added new cards to Anki
- Modified existing cards
- Updated media files
- Fixed card formatting

### Update Process

```bash
# 1. Export from Anki using CrowdAnki (overwrites anki/ directory)
# File → CrowdAnki: Export → anki/

# 2. Prepare files
cd anki
mv deck.json ankoma.json  # if needed
mv media_files media      # if needed

# 3. Upload media (replaces existing files)
curl -X POST http://localhost:3000/api/media/r2/upload-anki-media | jq .

# 4. Upload JSON
wrangler r2 object put pathology-bites-images/anki/ankoma.json \
  --file=anki/ankoma.json

# 5. Clear browser cache and test
# Visit /dashboard/anki with hard refresh (Cmd+Shift+R)
```

### Partial Updates

If you only changed a few cards:

```bash
# Option 1: Upload only new media files
# (requires manual filtering - not recommended)

# Option 2: Re-upload everything (recommended)
# The script replaces files, so duplicate uploads are fine
curl -X POST http://localhost:3000/api/media/r2/upload-anki-media
```

---

## Performance Metrics

### Expected Upload Times

| File Count | Total Size | Compressed Size | Upload Time |
|------------|------------|-----------------|-------------|
| 100 files  | ~50 MB     | ~12 MB          | ~30 sec     |
| 500 files  | ~250 MB    | ~60 MB          | ~2 min      |
| 1000 files | ~500 MB    | ~120 MB         | ~4 min      |
| 2000 files | ~1 GB      | ~250 MB         | ~8 min      |

*Times assume good internet connection and standard image sizes*

### Compression Ratios

| Image Type | Typical Original | Compressed | Savings |
|------------|------------------|------------|---------|
| PNG (screenshots) | 500 KB | 80 KB | 84% |
| JPEG (photos) | 300 KB | 85 KB | 72% |
| SVG (diagrams) | 50 KB | 50 KB | 0% (already optimal) |

---

## Best Practices

### 1. Keep Originals

```bash
# Add to .gitignore
echo "anki/" >> .gitignore

# But keep a backup elsewhere
cp -r anki/ ~/backups/anki-$(date +%Y%m%d)/
```

### 2. Version Control JSON

The `ankoma.json` structure is valuable for tracking:
- Card content changes
- Deck reorganization
- Field modifications

Consider versioning it separately or keeping change logs.

### 3. Test Before Production

Always test on localhost before uploading:
1. Export from Anki
2. Upload to local dev server
3. Test in `/dashboard/anki`
4. If good, upload to production R2

### 4. Monitor R2 Costs

```bash
# Check R2 storage size
wrangler r2 bucket info pathology-bites-images

# List large files
wrangler r2 object list pathology-bites-images \
  --prefix=anki/ \
  | jq '.objects | sort_by(.size) | reverse | .[0:10]'
```

### 5. Progressive Updates

For large decks:
- Export and upload weekly/monthly
- Track which cards are new vs modified
- Consider selective uploads for minor changes

---

## Advanced: Batch Processing Script

For very large decks, create a bash script:

```bash
#!/bin/bash
# upload-anki.sh

set -e

echo "🚀 Starting Anki upload process..."

# 1. Verify directory
if [ ! -d "anki/media" ]; then
  echo "❌ Error: anki/media directory not found"
  exit 1
fi

# 2. Count files
FILE_COUNT=$(ls anki/media | wc -l)
echo "📁 Found $FILE_COUNT media files"

# 3. Upload media
echo "📤 Uploading and compressing media files..."
curl -X POST http://localhost:3000/api/media/r2/upload-anki-media \
  -H "Content-Type: application/json" \
  | jq '.uploadedFiles, .compressionRatio, .errors'

# 4. Upload JSON
echo "📤 Uploading ankoma.json..."
wrangler r2 object put pathology-bites-images/anki/ankoma.json \
  --file=anki/ankoma.json \
  --content-type="application/json"

echo "✅ Upload complete!"
echo "🔗 Test at: http://localhost:3000/dashboard/anki"
```

Usage:
```bash
chmod +x upload-anki.sh
./upload-anki.sh
```

---

## Security Considerations

### Public Access

Media files in R2 are **publicly accessible** at:
```
https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/anki/<filename>
```

**Do not include:**
- Personal identifying information in images
- Copyrighted material without permission
- Patient data (HIPAA violation)
- Proprietary textbook images

### Content Review

Before uploading:
1. Review all media files for sensitive content
2. Ensure proper attribution for sourced images
3. Verify compliance with fair use guidelines
4. Remove any personal notes/annotations

---

## Related Documentation

- [Anki Viewer README](../src/features/anki/README.md) - Component documentation
- [CrowdAnki GitHub](https://github.com/Stvad/CrowdAnki) - Export tool documentation
- [Sharp Documentation](https://sharp.pixelplumbing.com/) - Image processing library

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-12-21 | Initial documentation created | System |
| 2025-12-21 | Added compression workflow | System |

---

## Questions?

For issues or improvements:
1. Check troubleshooting section above
2. Review related documentation
3. Test with a small subset of files first
4. Open an issue if problem persists
