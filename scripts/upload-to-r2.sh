#!/bin/bash
# Upload compressed Anki media to R2 via Wrangler CLI
# Files will automatically replace existing files with same names

set -e

echo "📤 Uploading Anki Media to R2"
echo "=============================="
echo ""

# Configuration
MEDIA_DIR="anki/media"
JSON_FILE="anki/ankoma.json"
R2_BUCKET="pathology-bites-images"
R2_PREFIX="anki"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if directory exists
if [ ! -d "$MEDIA_DIR" ]; then
  echo -e "${RED}❌ Error: $MEDIA_DIR directory not found${NC}"
  exit 1
fi

# Check if wrangler is available (via npx or global install)
if ! command -v wrangler &> /dev/null && ! npx wrangler --version &> /dev/null; then
  echo -e "${RED}❌ Wrangler CLI not found${NC}"
  echo "Install with: npm install -g wrangler"
  exit 1
fi

# Use npx if wrangler not in PATH
WRANGLER_CMD="wrangler"
if ! command -v wrangler &> /dev/null; then
  WRANGLER_CMD="npx wrangler"
fi

# Count files
FILE_COUNT=$(find "$MEDIA_DIR" -type f | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1 || echo "Unknown")

echo -e "${CYAN}📊 Media files: $FILE_COUNT${NC}"
echo -e "${CYAN}📦 Total size: $TOTAL_SIZE${NC}"
echo ""
echo -e "${BLUE}Uploading to: $R2_BUCKET/$R2_PREFIX/${NC}"
echo ""

read -p "Continue with upload? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Upload cancelled"
  exit 0
fi

echo ""
echo -e "${BLUE}📤 Uploading media files...${NC}"
echo ""

UPLOADED=0
FAILED=0
START_TIME=$(date +%s)

for file in "$MEDIA_DIR"/*; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    r2_key="$R2_PREFIX/$filename"

    # Determine content type
    ext="${filename##*.}"
    case "$ext" in
      png|png_m) content_type="image/png" ;;
      jpg|jpeg|jpglarge) content_type="image/jpeg" ;;
      svg) content_type="image/svg+xml" ;;
      gif) content_type="image/gif" ;;
      *) content_type="application/octet-stream" ;;
    esac

    # Upload
    if $WRANGLER_CMD r2 object put "$R2_BUCKET/$r2_key" \
      --file="$file" \
      --content-type="$content_type" 2>/dev/null; then
      ((UPLOADED++))
      if [ $((UPLOADED % 100)) -eq 0 ]; then
        ELAPSED=$(($(date +%s) - START_TIME))
        RATE=$(echo "scale=1; $UPLOADED / $ELAPSED" | bc)
        ETA=$(echo "scale=0; ($FILE_COUNT - $UPLOADED) / $RATE" | bc)
        echo -e "  ${GREEN}✅ Uploaded $UPLOADED/$FILE_COUNT files... ($RATE f/s, ETA: ${ETA}s)${NC}"
      fi
    else
      ((FAILED++))
      echo -e "  ${RED}❌ Failed: $filename${NC}"
    fi
  fi
done

echo ""
echo -e "${GREEN}✅ Media upload complete: $UPLOADED uploaded, $FAILED failed${NC}"
echo ""

# Upload JSON
if [ -f "$JSON_FILE" ]; then
  echo -e "${BLUE}📤 Uploading JSON file...${NC}"
  if $WRANGLER_CMD r2 object put "$R2_BUCKET/$R2_PREFIX/ankoma.json" \
    --file="$JSON_FILE" \
    --content-type="application/json"; then
    echo -e "${GREEN}✅ JSON uploaded${NC}"
  else
    echo -e "${RED}❌ JSON upload failed${NC}"
  fi
fi

TOTAL_TIME=$(($(date +%s) - START_TIME))
echo ""
echo "================================"
echo -e "${GREEN}✅ Upload Complete!${NC}"
echo "================================"
echo ""
echo "📊 Summary:"
echo "   Files uploaded: $UPLOADED"
echo "   Failed: $FAILED"
echo "   Duration: ${TOTAL_TIME}s"
echo ""
echo "🌐 Files are now available at:"
echo "   https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/anki/<filename>"
echo ""
