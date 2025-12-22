#!/bin/bash
# Complete Anki workflow: Compress + Smart Upload to R2
# 1. Compresses anki/media locally (1.2GB → ~0.5GB)
# 2. Uploads ankoma.json
# 3. Uploads compressed files (only if smaller than R2 version)

set -e

echo "🎴 Complete Anki Compress + Upload Workflow"
echo "============================================"
echo ""

# Configuration
MEDIA_DIR="anki/media"
# Support both deck.json and ankoma.json
if [ -f "anki/deck.json" ]; then
  JSON_FILE="anki/deck.json"
elif [ -f "anki/ankoma.json" ]; then
  JSON_FILE="anki/ankoma.json"
else
  JSON_FILE=""
fi
R2_BUCKET="pathology-bites-images"
R2_PREFIX="anki"
PARALLEL_WORKERS=8

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ============================================================================
# STEP 0: Prerequisites
# ============================================================================

echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if [ ! -d "$MEDIA_DIR" ]; then
  echo -e "${RED}❌ Error: $MEDIA_DIR not found${NC}"
  exit 1
fi

if ! command -v wrangler &> /dev/null; then
  echo -e "${RED}❌ Wrangler not found. Install: npm install -g wrangler${NC}"
  exit 1
fi

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not found${NC}"
  exit 1
fi

# Check Sharp is available
if ! node -e "require('sharp')" 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Sharp not installed. Installing...${NC}"
  npm install sharp
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Show current sizes
LOCAL_COUNT=$(find "$MEDIA_DIR" -type f | wc -l | tr -d ' ')
CURRENT_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1)
echo -e "${CYAN}📁 Local files: $LOCAL_COUNT${NC}"
echo -e "${CYAN}📦 Current size: $CURRENT_SIZE${NC}"
echo ""

# ============================================================================
# STEP 1: Compress Images
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 STEP 1: Compress Images (Target: ~0.3-0.5 GB)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Choose compression method:"
echo "  1) pngquant + mozjpeg (RECOMMENDED - 70-80% reduction)"
echo "  2) Sharp (Node.js - less effective for PNGs)"
echo "  3) Skip compression"
echo ""
read -p "Enter choice (1/2/3): " -n 1 -r </dev/tty
echo ""

COMPRESS_CHOICE=$REPLY

if [ "$COMPRESS_CHOICE" = "1" ]; then
  echo -e "${CYAN}🔄 Running pngquant + mozjpeg compression...${NC}"
  echo ""
  ./scripts/compress-anki-pngquant.sh

  NEW_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1)
  echo -e "${CYAN}📦 New size: $NEW_SIZE (was $CURRENT_SIZE)${NC}"
elif [ "$COMPRESS_CHOICE" = "2" ]; then
  echo -e "${CYAN}🔄 Running Sharp compression...${NC}"
  echo ""
  node scripts/compress-anki-media.js

  NEW_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1)
  echo -e "${CYAN}📦 New size: $NEW_SIZE (was $CURRENT_SIZE)${NC}"
else
  echo -e "${YELLOW}⏭️  Compression skipped${NC}"
fi
echo ""

# ============================================================================
# STEP 2: Upload JSON file (deck.json or ankoma.json)
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 STEP 2: Upload JSON file${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$JSON_FILE" ] && [ -f "$JSON_FILE" ]; then
  JSON_SIZE=$(du -h "$JSON_FILE" | cut -f1)
  echo -e "${CYAN}📄 Found: $JSON_FILE ($JSON_SIZE)${NC}"
  echo -e "${CYAN}   Will upload as: $R2_PREFIX/ankoma.json${NC}"

  read -p "Upload JSON file? (y/N): " -n 1 -r </dev/tty
  echo ""

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    if wrangler r2 object put "$R2_BUCKET/$R2_PREFIX/ankoma.json" \
      --file="$JSON_FILE" \
      --content-type="application/json"; then
      echo -e "${GREEN}✅ JSON uploaded successfully${NC}"
    else
      echo -e "${RED}❌ JSON upload failed${NC}"
    fi
  else
    echo -e "${YELLOW}⏭️  JSON upload skipped${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  No JSON file found (looked for anki/deck.json and anki/ankoma.json)${NC}"
fi
echo ""

# ============================================================================
# STEP 3: Smart Upload Media (only if local is smaller)
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 STEP 3: Smart Upload Media (skip if R2 is smaller)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}📡 Fetching R2 file list with sizes...${NC}"

# Get R2 files with sizes (key and size)
wrangler r2 object list "$R2_BUCKET" --prefix="$R2_PREFIX/" 2>/dev/null | \
  jq -r '.[] | "\(.key):\(.size)"' 2>/dev/null > /tmp/r2-files-sizes.txt || echo "" > /tmp/r2-files-sizes.txt

R2_COUNT=$(wc -l < /tmp/r2-files-sizes.txt | tr -d ' ')
echo -e "${GREEN}✅ Found $R2_COUNT files in R2${NC}"

# Create upload list: only files where local is smaller
echo -e "${CYAN}🔍 Comparing local vs R2 sizes...${NC}"

cd "$MEDIA_DIR"
UPLOAD_LIST="/tmp/r2-upload-list.txt"
SKIP_COUNT=0
UPLOAD_COUNT=0
> "$UPLOAD_LIST"

for file in *; do
  if [ -f "$file" ]; then
    LOCAL_SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    R2_KEY="$R2_PREFIX/$file"
    R2_SIZE=$(grep "^$R2_KEY:" /tmp/r2-files-sizes.txt | cut -d: -f2)

    if [ -z "$R2_SIZE" ]; then
      # File not in R2, upload it
      echo "$file" >> "$UPLOAD_LIST"
      ((UPLOAD_COUNT++))
    elif [ "$LOCAL_SIZE" -lt "$R2_SIZE" ]; then
      # Local is smaller, upload it
      echo "$file" >> "$UPLOAD_LIST"
      ((UPLOAD_COUNT++))
    else
      # R2 version is same size or smaller, skip
      ((SKIP_COUNT++))
    fi
  fi
done

echo -e "${GREEN}✅ Files to upload (local smaller): $UPLOAD_COUNT${NC}"
echo -e "${YELLOW}⏭️  Files to skip (R2 same/smaller): $SKIP_COUNT${NC}"
echo ""

if [ "$UPLOAD_COUNT" -eq 0 ]; then
  echo -e "${GREEN}🎉 All files are already optimally uploaded!${NC}"
  rm -f /tmp/r2-files-sizes.txt /tmp/r2-upload-list.txt
  exit 0
fi

# Estimate time
EST_SECONDS=$((UPLOAD_COUNT / PARALLEL_WORKERS))
EST_MINUTES=$((EST_SECONDS / 60))
echo -e "${CYAN}⏱️  Estimated time: ~${EST_MINUTES} minutes with $PARALLEL_WORKERS parallel workers${NC}"
echo ""

read -p "Start parallel upload of $UPLOAD_COUNT files? (y/N): " -n 1 -r </dev/tty
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  rm -f /tmp/r2-files-sizes.txt /tmp/r2-upload-list.txt
  exit 0
fi

echo ""
echo -e "${BLUE}🚀 Starting parallel upload...${NC}"
echo ""

START_TIME=$(date +%s)
PROGRESS_DIR="/tmp/r2-progress-$$"
rm -rf "$PROGRESS_DIR"
mkdir -p "$PROGRESS_DIR"

# Export for subshells
FAILED_DIR="/tmp/r2-failed-$$"
mkdir -p "$FAILED_DIR"
export R2_BUCKET R2_PREFIX PROGRESS_DIR FAILED_DIR UPLOAD_COUNT GREEN YELLOW RED NC START_TIME

upload_file() {
  local file="$1"
  local ext="${file##*.}"
  local ct="application/octet-stream"

  case "$ext" in
    png|png_m) ct="image/png" ;;
    jpg|jpeg|jpglarge) ct="image/jpeg" ;;
    svg) ct="image/svg+xml" ;;
    gif) ct="image/gif" ;;
  esac

  # Suppress ALL wrangler output (stdout and stderr)
  if wrangler r2 object put "$R2_BUCKET/$R2_PREFIX/$file" \
    --file="$file" \
    --content-type="$ct" >/dev/null 2>&1; then

    # Atomic progress: touch a file for each completed upload
    touch "$PROGRESS_DIR/$file"

    # Count completed files (atomic read)
    COUNT=$(ls -1 "$PROGRESS_DIR" 2>/dev/null | wc -l | tr -d ' ')

    # Show progress every 50 files
    if [ $((COUNT % 50)) -eq 0 ] && [ "$COUNT" -gt 0 ]; then
      ELAPSED=$(($(date +%s) - START_TIME))
      if [ "$ELAPSED" -gt 0 ]; then
        RATE=$(echo "scale=1; $COUNT / $ELAPSED" | bc 2>/dev/null || echo "1")
        REMAINING=$((UPLOAD_COUNT - COUNT))
        ETA_SEC=$(echo "scale=0; $REMAINING / $RATE" | bc 2>/dev/null || echo "0")
        ETA_MIN=$((ETA_SEC / 60))
        PCT=$((COUNT * 100 / UPLOAD_COUNT))
        FAIL_COUNT=$(wc -l < "$FAILED_DIR/failed.txt" 2>/dev/null | tr -d ' ' || echo "0")
        if [ "$FAIL_COUNT" -gt 0 ] 2>/dev/null; then
          printf "\r  📤 %d/%d (%d%%) | ❌ %d failed | %.1f/s | ~%dm left        " "$COUNT" "$UPLOAD_COUNT" "$PCT" "$FAIL_COUNT" "$RATE" "$ETA_MIN"
        else
          printf "\r  📤 %d/%d (%d%%) | %.1f/s | ~%dm left                       " "$COUNT" "$UPLOAD_COUNT" "$PCT" "$RATE" "$ETA_MIN"
        fi
      fi
    fi
  else
    # Track failed file for retry
    echo "$file" >> "$FAILED_DIR/failed.txt"
  fi
}
export -f upload_file

# Run parallel uploads
cat "$UPLOAD_LIST" | xargs -P "$PARALLEL_WORKERS" -I {} bash -c 'upload_file "$@"' _ {}

# Count failures
FAILED_COUNT=0
if [ -f "$FAILED_DIR/failed.txt" ]; then
  FAILED_COUNT=$(wc -l < "$FAILED_DIR/failed.txt" | tr -d ' ')
fi

# Final summary
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
FINAL_COUNT=$(ls -1 "$PROGRESS_DIR" 2>/dev/null | wc -l | tr -d ' ')
RATE=$(echo "scale=2; $FINAL_COUNT / $TOTAL_TIME" | bc 2>/dev/null || echo "?")

echo ""
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$FAILED_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ COMPLETE!${NC}"
else
  echo -e "${YELLOW}⚠️  COMPLETE WITH ERRORS${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Summary:"
echo "   Files uploaded: $FINAL_COUNT / $UPLOAD_COUNT"
echo "   Files skipped (R2 smaller): $SKIP_COUNT"
if [ "$FAILED_COUNT" -gt 0 ]; then
  echo -e "   ${RED}Files failed: $FAILED_COUNT${NC}"
fi
echo "   Duration: $((TOTAL_TIME / 60))m $((TOTAL_TIME % 60))s"
echo "   Rate: $RATE files/sec"
echo ""
echo "🌐 Test at: https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/anki/"
echo ""

# Handle failures
if [ "$FAILED_COUNT" -gt 0 ]; then
  cp "$FAILED_DIR/failed.txt" /tmp/r2-failed-files.txt
  echo -e "${YELLOW}📋 Failed files saved to: /tmp/r2-failed-files.txt${NC}"
  echo ""
  echo "To retry failed uploads, run:"
  echo "  cd anki/media && cat /tmp/r2-failed-files.txt | xargs -P 4 -I {} wrangler r2 object put pathology-bites-images/anki/{} --file={}"
  echo ""
fi

# Cleanup
rm -rf /tmp/r2-files-sizes.txt /tmp/r2-upload-list.txt "$PROGRESS_DIR" "$FAILED_DIR"

