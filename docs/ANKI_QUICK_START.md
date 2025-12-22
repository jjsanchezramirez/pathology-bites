# Anki Deck Upload - Quick Start

**For the full guide, see [ANKI_WORKFLOW.md](./ANKI_WORKFLOW.md)**

## TL;DR - Update Your Anki Deck

### Option 1: All-in-One Script (Recommended)

```bash
# 1. Export from Anki
#    File → CrowdAnki: Export → choose anki/ directory

# 2. Run the complete workflow script
./scripts/compress-and-upload-anki.sh

# This script will:
#   • Validate your export
#   • Compress images in-place (70-85% size reduction)
#   • Upload everything to R2
#   • Verify the upload

# 3. Test
# Visit http://localhost:3000/dashboard/anki
# Hard refresh: Cmd+Shift+R
```

### Option 2: Step-by-Step (Manual Control)

```bash
# 1. Export from Anki
#    File → CrowdAnki: Export → choose anki/ directory

# 2. Prepare files
cd anki
mv deck.json ankoma.json     # rename if needed
mv media_files media         # rename if needed
cd ..

# 3. Upload with server-side compression
./scripts/upload-anki.sh

# 4. Upload JSON
wrangler r2 object put pathology-bites-images/anki/ankoma.json \
  --file=anki/ankoma.json \
  --content-type="application/json"

# 5. Test
# Visit http://localhost:3000/dashboard/anki
# Hard refresh: Cmd+Shift+R
```

## Compression Methods

### All-in-One Script (compress-and-upload-anki.sh)
- **Compresses locally** before upload using Sharp via Node.js
- **Faster** - no need to upload large originals
- **More control** - choose between Wrangler or API upload
- **In-place compression** - modifies files directly (no originals kept)

### Step-by-Step Method (upload-anki.sh)
- **Compresses during upload** via API endpoint
- **Requires dev server** running
- **Keeps originals** in anki/ directory (git-ignored)

## What Gets Compressed?

| Format | Quality | Max Dimensions | Notes |
|--------|---------|----------------|-------|
| JPEG | 85% | 2400x2400 | MozJPEG, progressive |
| PNG | 85% | 2400x2400 | Level 9 compression |
| SVG | No change | - | Already optimal |
| GIF | Light | - | Preserves animation |

## Expected Results

- **Compression:** 70-85% file size reduction
- **Quality:** Visually identical for medical images
- **Speed:** ~2-5 files/sec upload
- **R2 Behavior:** Replaces existing files with same name

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Directory not found | Ensure `anki/media/` exists |
| Server not running | Run `npm run dev` first |
| Images look blurry | Increase quality in `upload-anki-media/route.ts` |
| Upload fails | Check R2 credentials and bucket name |

## File Structure

```
pathology-bites/
├── anki/                        # Git-ignored, keep local
│   ├── ankoma.json              # Deck structure
│   └── media/                   # Original images
│       ├── paste-123.png
│       └── ...
├── scripts/
│   └── upload-anki.sh          # Upload helper script
└── src/app/api/media/r2/
    └── upload-anki-media/
        └── route.ts             # Upload with compression
```

## Next Steps

1. **Test locally** - Always test before production upload
2. **Check quality** - Spot-check a few images in the viewer
3. **Monitor size** - Verify compression savings in response
4. **Update regularly** - Re-export and upload when cards change

---

**For detailed documentation:** [ANKI_WORKFLOW.md](./ANKI_WORKFLOW.md)
