#!/bin/bash
# Complete Anki workflow: compress images locally, then upload everything to R2
# This compresses images in-place before uploading, so no originals are kept

set -e

echo "🎴 Complete Anki Upload Workflow"
echo "================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
ANKI_DIR="anki"
MEDIA_DIR="$ANKI_DIR/media"
JSON_FILE="$ANKI_DIR/ankoma.json"
R2_BUCKET="pathology-bites-images"
R2_PREFIX="anki"

# Compression settings (matches the API settings)
MAX_WIDTH=2400
MAX_HEIGHT=2400
JPEG_QUALITY=85
PNG_QUALITY=85

# ============================================================================
# STEP 1: Validate Prerequisites
# ============================================================================

echo -e "${BLUE}📋 Step 1: Checking prerequisites...${NC}"
echo ""

# Check if anki directory exists
if [ ! -d "$ANKI_DIR" ]; then
  echo -e "${RED}❌ Error: $ANKI_DIR directory not found${NC}"
  echo ""
  echo "Please export your Anki deck first:"
  echo "  1. Open Anki Desktop"
  echo "  2. File → CrowdAnki: Export"
  echo "  3. Choose the directory: $(pwd)/anki"
  echo ""
  exit 1
fi

# Check if media directory exists
if [ ! -d "$MEDIA_DIR" ]; then
  echo -e "${YELLOW}⚠️  Warning: $MEDIA_DIR directory not found${NC}"
  echo "Looking for alternative media directory..."

  if [ -d "$ANKI_DIR/media_files" ]; then
    echo -e "${BLUE}Found media_files/, renaming to media/${NC}"
    mv "$ANKI_DIR/media_files" "$MEDIA_DIR"
  else
    echo -e "${RED}❌ No media directory found${NC}"
    exit 1
  fi
fi

# Check if JSON file exists
if [ ! -f "$JSON_FILE" ]; then
  # Try to find deck.json
  if [ -f "$ANKI_DIR/deck.json" ]; then
    echo -e "${BLUE}Found deck.json, renaming to ankoma.json${NC}"
    mv "$ANKI_DIR/deck.json" "$JSON_FILE"
  else
    echo -e "${YELLOW}⚠️  Warning: $JSON_FILE not found${NC}"
    echo "Please ensure you have a JSON file in the anki/ directory"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# Check if Sharp is available (via Node.js)
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not found${NC}"
  echo "Please install Node.js to use Sharp for compression"
  exit 1
fi

# Check if ImageMagick is available (alternative for compression)
MAGICK_AVAILABLE=false
if command -v magick &> /dev/null; then
  MAGICK_AVAILABLE=true
  echo -e "${GREEN}✅ ImageMagick found${NC}"
elif command -v convert &> /dev/null; then
  MAGICK_AVAILABLE=true
  echo -e "${GREEN}✅ ImageMagick (convert) found${NC}"
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo -e "${YELLOW}⚠️  Wrangler CLI not found${NC}"
  echo "JSON upload will be skipped. Install with: npm install -g wrangler"
  WRANGLER_AVAILABLE=false
else
  WRANGLER_AVAILABLE=true
  echo -e "${GREEN}✅ Wrangler CLI found${NC}"
fi

echo -e "${GREEN}✅ Prerequisites checked${NC}"
echo ""

# Count files
FILE_COUNT=$(find "$MEDIA_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.gif" -o -iname "*.svg" \) | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1 || echo "Unknown")

echo -e "${CYAN}📊 Media files found: $FILE_COUNT${NC}"
echo -e "${CYAN}📦 Total size (before compression): $TOTAL_SIZE${NC}"
echo ""

# ============================================================================
# STEP 2: Compress Images Locally
# ============================================================================

echo -e "${BLUE}📋 Step 2: Compressing images locally...${NC}"
echo ""
echo "Settings:"
echo "  • Max dimensions: ${MAX_WIDTH}x${MAX_HEIGHT}px"
echo "  • JPEG quality: ${JPEG_QUALITY}%"
echo "  • PNG quality: ${PNG_QUALITY}%"
echo ""

read -p "Compress images in-place? This will modify files in $MEDIA_DIR (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Compression skipped - will upload originals${NC}"
  echo ""
  SKIP_COMPRESSION=true
else
  SKIP_COMPRESSION=false

  # Create a Node.js script for compression using Sharp
  cat > /tmp/compress-anki-images.js << 'COMPRESS_SCRIPT'
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const COMPRESSION_CONFIG = {
  maxWidth: parseInt(process.env.MAX_WIDTH || '2400'),
  maxHeight: parseInt(process.env.MAX_HEIGHT || '2400'),
  jpeg: {
    quality: parseInt(process.env.JPEG_QUALITY || '85'),
    progressive: true,
    mozjpeg: true
  },
  png: {
    quality: parseInt(process.env.PNG_QUALITY || '85'),
    compressionLevel: 9,
    progressive: true
  }
};

async function compressImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const originalStats = await fs.stat(filePath);
  const originalSize = originalStats.size;

  // Skip SVG and GIF
  if (ext === '.svg' || ext === '.gif') {
    console.log(`  ⏭️  Skipping ${path.basename(filePath)} (${ext})`);
    return { originalSize, compressedSize: originalSize, skipped: true };
  }

  try {
    let pipeline = sharp(filePath);
    const metadata = await pipeline.metadata();

    // Resize if needed
    if (metadata.width > COMPRESSION_CONFIG.maxWidth || metadata.height > COMPRESSION_CONFIG.maxHeight) {
      pipeline = pipeline.resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
      console.log(`  📏 Resizing ${path.basename(filePath)}: ${metadata.width}x${metadata.height} → ${COMPRESSION_CONFIG.maxWidth}x${COMPRESSION_CONFIG.maxHeight}`);
    }

    // Compress based on format
    let compressed;
    if (ext === '.png') {
      compressed = await pipeline
        .png({
          quality: COMPRESSION_CONFIG.png.quality,
          compressionLevel: COMPRESSION_CONFIG.png.compressionLevel,
          progressive: COMPRESSION_CONFIG.png.progressive
        })
        .toBuffer();
    } else {
      compressed = await pipeline
        .jpeg({
          quality: COMPRESSION_CONFIG.jpeg.quality,
          progressive: COMPRESSION_CONFIG.jpeg.progressive,
          mozjpeg: COMPRESSION_CONFIG.jpeg.mozjpeg
        })
        .toBuffer();
    }

    const compressionRatio = compressed.length / originalSize;
    const savings = ((1 - compressionRatio) * 100).toFixed(1);

    // Only write if we achieved compression
    if (compressed.length < originalSize) {
      await fs.writeFile(filePath, compressed);
      console.log(`  ✅ ${path.basename(filePath)}: ${(originalSize/1024).toFixed(1)} KB → ${(compressed.length/1024).toFixed(1)} KB (${savings}% saved)`);
      return { originalSize, compressedSize: compressed.length, skipped: false };
    } else {
      console.log(`  ⏭️  ${path.basename(filePath)}: compressed size larger, keeping original`);
      return { originalSize, compressedSize: originalSize, skipped: true };
    }
  } catch (error) {
    console.error(`  ❌ Failed to compress ${path.basename(filePath)}:`, error.message);
    return { originalSize, compressedSize: originalSize, skipped: true, error: true };
  }
}

async function main() {
  const mediaDir = process.argv[2];
  if (!mediaDir) {
    console.error('Usage: node compress-anki-images.js <media-directory>');
    process.exit(1);
  }

  const files = await fs.readdir(mediaDir);
  const imageFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
  });

  console.log(`\n🖼️  Compressing ${imageFiles.length} images...\n`);

  let totalOriginal = 0;
  let totalCompressed = 0;
  let processedCount = 0;
  let errorCount = 0;

  for (const file of imageFiles) {
    const filePath = path.join(mediaDir, file);
    const result = await compressImage(filePath);

    totalOriginal += result.originalSize;
    totalCompressed += result.compressedSize;
    if (!result.skipped) processedCount++;
    if (result.error) errorCount++;
  }

  const overallRatio = totalCompressed / totalOriginal;
  const overallSavings = ((1 - overallRatio) * 100).toFixed(1);

  console.log(`\n📊 Compression Summary:`);
  console.log(`   Files processed: ${processedCount}/${imageFiles.length}`);
  console.log(`   Original size: ${(totalOriginal/1024/1024).toFixed(2)} MB`);
  console.log(`   Compressed size: ${(totalCompressed/1024/1024).toFixed(2)} MB`);
  console.log(`   Total savings: ${overallSavings}%`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount}`);
  }
  console.log('');
}

main().catch(console.error);
COMPRESS_SCRIPT

  # Run compression
  echo -e "${CYAN}🔄 Running compression...${NC}"
  echo ""

  MAX_WIDTH=$MAX_WIDTH MAX_HEIGHT=$MAX_HEIGHT JPEG_QUALITY=$JPEG_QUALITY PNG_QUALITY=$PNG_QUALITY \
    node /tmp/compress-anki-images.js "$MEDIA_DIR"

  # Clean up
  rm /tmp/compress-anki-images.js

  echo -e "${GREEN}✅ Compression complete${NC}"
  echo ""

  # Show new size
  NEW_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1 || echo "Unknown")
  echo -e "${CYAN}📦 New total size: $NEW_SIZE${NC}"
  echo ""
fi

# ============================================================================
# STEP 3: Upload to R2
# ============================================================================

echo -e "${BLUE}📋 Step 3: Uploading to R2...${NC}"
echo ""

# Ask which method to use
echo "Choose upload method:"
echo "  1) Wrangler CLI (recommended - direct upload)"
echo "  2) API endpoint (requires dev server running)"
echo ""
read -p "Enter choice (1 or 2): " -n 1 -r
echo ""
UPLOAD_METHOD=$REPLY

if [ "$UPLOAD_METHOD" = "1" ]; then
  # ========================================================================
  # Upload via Wrangler CLI
  # ========================================================================

  if [ "$WRANGLER_AVAILABLE" = false ]; then
    echo -e "${RED}❌ Wrangler is not installed${NC}"
    echo "Install with: npm install -g wrangler"
    exit 1
  fi

  echo -e "${CYAN}📤 Uploading via Wrangler CLI...${NC}"
  echo ""

  # Upload media files
  echo -e "${BLUE}Uploading media files to $R2_BUCKET/$R2_PREFIX/...${NC}"

  UPLOADED=0
  FAILED=0

  for file in "$MEDIA_DIR"/*; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      r2_key="$R2_PREFIX/$filename"

      # Determine content type
      ext="${filename##*.}"
      case "$ext" in
        png) content_type="image/png" ;;
        jpg|jpeg) content_type="image/jpeg" ;;
        svg) content_type="image/svg+xml" ;;
        gif) content_type="image/gif" ;;
        *) content_type="application/octet-stream" ;;
      esac

      # Upload
      if wrangler r2 object put "$R2_BUCKET/$r2_key" \
        --file="$file" \
        --content-type="$content_type" 2>/dev/null; then
        ((UPLOADED++))
        if [ $((UPLOADED % 10)) -eq 0 ]; then
          echo "  ✅ Uploaded $UPLOADED files..."
        fi
      else
        ((FAILED++))
        echo "  ❌ Failed: $filename"
      fi
    fi
  done

  echo ""
  echo -e "${GREEN}✅ Media upload complete: $UPLOADED uploaded, $FAILED failed${NC}"
  echo ""

  # Upload JSON
  if [ -f "$JSON_FILE" ]; then
    echo -e "${BLUE}Uploading JSON file...${NC}"
    if wrangler r2 object put "$R2_BUCKET/$R2_PREFIX/ankoma.json" \
      --file="$JSON_FILE" \
      --content-type="application/json"; then
      echo -e "${GREEN}✅ JSON uploaded${NC}"
    else
      echo -e "${RED}❌ JSON upload failed${NC}"
    fi
  fi

elif [ "$UPLOAD_METHOD" = "2" ]; then
  # ========================================================================
  # Upload via API endpoint
  # ========================================================================

  # Check if server is running
  if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Dev server is not running${NC}"
    echo "Please start it with: npm run dev"
    exit 1
  fi

  echo -e "${CYAN}📤 Uploading via API endpoint...${NC}"
  echo ""

  # Note: The API will skip compression since we already compressed
  UPLOAD_RESULT=$(curl -s -X POST http://localhost:3000/api/media/r2/upload-anki-media)

  # Parse and display results
  SUCCESS=$(echo "$UPLOAD_RESULT" | jq -r '.success')
  UPLOADED=$(echo "$UPLOAD_RESULT" | jq -r '.uploadedFiles')
  FAILED=$(echo "$UPLOAD_RESULT" | jq -r '.failedFiles')

  if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Upload complete: $UPLOADED uploaded, $FAILED failed${NC}"
  else
    echo -e "${RED}❌ Upload failed${NC}"
    echo "$UPLOAD_RESULT" | jq '.'
  fi

  echo ""

  # Upload JSON via wrangler
  if [ "$WRANGLER_AVAILABLE" = true ] && [ -f "$JSON_FILE" ]; then
    echo -e "${BLUE}Uploading JSON file via Wrangler...${NC}"
    wrangler r2 object put "$R2_BUCKET/$R2_PREFIX/ankoma.json" \
      --file="$JSON_FILE" \
      --content-type="application/json"
  else
    echo -e "${YELLOW}⚠️  JSON file must be uploaded manually${NC}"
    echo "Run: wrangler r2 object put $R2_BUCKET/$R2_PREFIX/ankoma.json --file=$JSON_FILE --content-type=\"application/json\""
  fi

else
  echo -e "${RED}Invalid choice${NC}"
  exit 1
fi

# ============================================================================
# STEP 4: Verification
# ============================================================================

echo ""
echo -e "${BLUE}📋 Step 4: Verification${NC}"
echo ""

# Test a random file
RANDOM_FILE=$(find "$MEDIA_DIR" -type f | head -1)
if [ -n "$RANDOM_FILE" ]; then
  RANDOM_FILENAME=$(basename "$RANDOM_FILE")
  R2_URL="https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/$R2_PREFIX/$RANDOM_FILENAME"

  echo -e "${BLUE}Testing random file access...${NC}"
  echo "File: $RANDOM_FILENAME"
  echo "URL: $R2_URL"
  echo ""

  if curl -I "$R2_URL" 2>/dev/null | grep -q "200 OK"; then
    echo -e "${GREEN}✅ File is accessible${NC}"
  else
    echo -e "${YELLOW}⚠️  File may not be accessible yet (CDN propagation)${NC}"
  fi
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=================================="
echo -e "${GREEN}✅ Upload workflow complete!${NC}"
echo "=================================="
echo ""

echo -e "${CYAN}📝 Next steps:${NC}"
echo ""
echo "1. Test in your application:"
echo "   http://localhost:3000/dashboard/anki"
echo ""
echo "2. Clear browser cache and hard refresh:"
echo "   Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)"
echo ""
echo "3. Verify images load correctly and quality is good"
echo ""

if [ "$SKIP_COMPRESSION" = false ]; then
  echo -e "${CYAN}💡 Tip:${NC}"
  echo "Images were compressed in-place. If you need originals:"
  echo "  • Re-export from Anki Desktop"
  echo "  • Or keep a backup before running this script"
  echo ""
fi

echo -e "${GREEN}🎉 All done!${NC}"
