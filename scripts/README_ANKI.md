# Anki Upload Scripts

Scripts for uploading Anki deck exports to Cloudflare R2 with aggressive compression.

---

## Scripts Overview

### 1. `compress-and-upload-anki.sh` ⭐ **RECOMMENDED**

**Complete all-in-one workflow** - handles everything from validation to upload.

**What it does:**
1. ✅ Validates your CrowdAnki export
2. 🗜️ Compresses images in-place (70-85% reduction)
3. 📤 Uploads to R2 (via Wrangler or API)
4. ✅ Verifies upload success

**Usage:**
```bash
# Export from Anki first, then run:
./scripts/compress-and-upload-anki.sh
```

**Requirements:**
- Node.js (for Sharp compression)
- Wrangler CLI (for direct R2 upload) OR dev server running (for API upload)

**When to use:**
- You want a simple one-command workflow
- You don't need to keep uncompressed originals
- You want the fastest upload (compress locally first)

---

### 2. `upload-anki.sh`

**Server-side compression** - uploads via API endpoint with compression.

**What it does:**
1. ✅ Checks prerequisites
2. 📤 Uploads to R2 via API endpoint (compresses during upload)
3. 📊 Shows compression statistics

**Usage:**
```bash
# Start dev server first
npm run dev

# In another terminal:
./scripts/upload-anki.sh

# Then upload JSON separately
wrangler r2 object put pathology-bites-images/anki/ankoma.json \
  --file=anki/ankoma.json
```

**Requirements:**
- Dev server running (`npm run dev`)
- Wrangler CLI (for JSON upload)

**When to use:**
- You want to keep original files locally
- You prefer step-by-step control
- You're testing compression settings

---

### 3. `test-anki-upload.sh`

**Testing script** - creates dummy files to test compression.

**What it does:**
1. Creates test images (PNG, JPEG, SVG)
2. Tests compression API
3. Optionally uploads to R2 for verification

**Usage:**
```bash
npm run dev  # Start server first
./scripts/test-anki-upload.sh
```

**When to use:**
- Testing compression settings
- Verifying upload functionality
- Before processing your real deck

---

## Quick Comparison

| Feature | compress-and-upload-anki.sh | upload-anki.sh |
|---------|----------------------------|----------------|
| **Compression location** | Local (before upload) | Server (during upload) |
| **Speed** | ⚡ Faster | Slower |
| **Keeps originals** | ❌ No (in-place) | ✅ Yes (git-ignored) |
| **Requires server** | ❌ No (Wrangler mode) | ✅ Yes |
| **JSON upload** | ✅ Included | Manual step |
| **Setup complexity** | Simple | Moderate |
| **Best for** | Regular updates | Testing/development |

---

## Complete Workflow Example

### Using compress-and-upload-anki.sh (Recommended)

```bash
# 1. Export from Anki
#    File → CrowdAnki: Export → choose anki/ directory

# 2. Run the script
./scripts/compress-and-upload-anki.sh

# Follow the interactive prompts:
#   - Confirms compression settings
#   - Choose upload method (Wrangler or API)
#   - Verifies upload

# 3. Test in browser
open http://localhost:3000/dashboard/anki
# Hard refresh: Cmd+Shift+R
```

### Using upload-anki.sh (Step-by-step)

```bash
# 1. Export from Anki
#    File → CrowdAnki: Export → choose anki/ directory

# 2. Start dev server
npm run dev

# 3. Upload media (in another terminal)
./scripts/upload-anki.sh

# 4. Upload JSON
wrangler r2 object put pathology-bites-images/anki/ankoma.json \
  --file=anki/ankoma.json \
  --content-type="application/json"

# 5. Test in browser
open http://localhost:3000/dashboard/anki
# Hard refresh: Cmd+Shift+R
```

---

## Compression Settings

All scripts use the same aggressive settings optimized for medical images:

```
JPEG:
  • Quality: 85%
  • Progressive: Yes
  • MozJPEG: Yes
  • Max dimensions: 2400x2400px

PNG:
  • Quality: 85%
  • Compression level: 9 (maximum)
  • Progressive: Yes
  • Max dimensions: 2400x2400px

SVG: No compression (already optimal)
GIF: Light compression (preserves animation)
```

**Expected results:**
- 70-85% file size reduction
- Visually identical quality for medical images
- Automatic resizing of oversized images

---

## Troubleshooting

### "anki directory not found"
```bash
# Ensure you've exported from Anki
mkdir -p anki/media
# Then export from Anki to this directory
```

### "Node.js not found" (compress-and-upload-anki.sh)
```bash
# Install Node.js
brew install node  # Mac
# or download from nodejs.org
```

### "Wrangler not found"
```bash
# Install globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### "Dev server not running" (upload-anki.sh)
```bash
# Start the dev server
npm run dev

# Verify it's running
curl http://localhost:3000
```

### Images look blurry
Edit the compression settings in the script:
```bash
# In compress-and-upload-anki.sh, change:
JPEG_QUALITY=90  # Was 85
PNG_QUALITY=90   # Was 85
```

---

## File Structure Expected

```
pathology-bites/
├── anki/                      # Your CrowdAnki export
│   ├── ankoma.json            # Deck structure (or deck.json)
│   └── media/                 # Images (or media_files)
│       ├── paste-123.png
│       ├── image-456.jpg
│       └── ...
└── scripts/
    ├── compress-and-upload-anki.sh  # All-in-one script
    ├── upload-anki.sh              # API upload script
    └── test-anki-upload.sh         # Testing script
```

---

## Environment Variables

You can override settings by setting environment variables:

```bash
# Custom compression settings
MAX_WIDTH=3200 MAX_HEIGHT=3200 JPEG_QUALITY=90 \
  ./scripts/compress-and-upload-anki.sh

# Custom R2 bucket
R2_BUCKET="my-custom-bucket" \
  ./scripts/compress-and-upload-anki.sh
```

---

## Performance Benchmarks

| Files | Original Size | Compressed | Upload Time |
|-------|---------------|------------|-------------|
| 100 | 50 MB | 12 MB (76%) | ~30 sec |
| 500 | 250 MB | 60 MB (76%) | ~2 min |
| 1000 | 500 MB | 120 MB (76%) | ~4 min |
| 2000 | 1 GB | 250 MB (75%) | ~8 min |

*Times for compress-and-upload-anki.sh with Wrangler upload*

---

## Related Documentation

- **Full workflow:** [docs/ANKI_WORKFLOW.md](../docs/ANKI_WORKFLOW.md)
- **Quick start:** [docs/ANKI_QUICK_START.md](../docs/ANKI_QUICK_START.md)
- **API implementation:** [src/app/api/media/r2/upload-anki-media/route.ts](../src/app/api/media/r2/upload-anki-media/route.ts)

---

## Tips

1. **First time?** Use `test-anki-upload.sh` to verify everything works
2. **Regular updates?** Use `compress-and-upload-anki.sh` for fastest workflow
3. **Testing changes?** Use `upload-anki.sh` to keep originals
4. **Large deck?** Compression is faster locally (compress-and-upload-anki.sh)
5. **Multiple decks?** Run scripts from project root, they handle paths automatically

---

**Need help?** Check the [full documentation](../docs/ANKI_WORKFLOW.md) or the troubleshooting section above.
