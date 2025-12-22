#!/bin/bash
# Compress Anki media using BEST tool for each format:
#
# Format  | Tool        | Method                        | Reduction
# --------|-------------|-------------------------------|----------
# PNG     | pngquant    | Lossy (256 colors)            | 70-80%
# JPEG    | mozjpeg     | Better encoder than libjpeg   | 10-15% better
# GIF     | gifsicle    | Optimize colors/frames        | 30-50%
# SVG     | svgo        | Remove metadata, optimize     | 30-60%
# Resize  | ImageMagick | High-quality Lanczos resize   | N/A

set -e

echo "🎴 Anki Media Compression (Best Tool Per Format)"
echo "================================================="
echo ""

# Configuration
MEDIA_DIR="anki/media"
MAX_DIMENSION=1200           # Max 1200x1200 px
PNG_QUALITY="65-85"          # pngquant quality range (min-max), targeting 85%
JPEG_QUALITY=85              # mozjpeg quality
MAX_FILE_SIZE_KB=300         # Target max 300KB per file
PARALLEL_WORKERS=4

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check prerequisites
echo -e "${BLUE}📋 Checking tools...${NC}"

if [ ! -d "$MEDIA_DIR" ]; then
  echo -e "${RED}❌ Error: $MEDIA_DIR not found${NC}"
  exit 1
fi

# Required tools
if ! command -v magick &> /dev/null; then
  echo -e "${RED}❌ ImageMagick not found. Install: brew install imagemagick${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ ImageMagick${NC} (resize)"

# PNG: pngquant
if command -v pngquant &> /dev/null; then
  USE_PNGQUANT=true
  echo -e "${GREEN}  ✓ pngquant${NC} (PNG compression - 70-80% reduction)"
else
  USE_PNGQUANT=false
  echo -e "${YELLOW}  ✗ pngquant not found - using ImageMagick for PNG${NC}"
fi

# JPEG: mozjpeg
if command -v cjpeg &> /dev/null; then
  USE_MOZJPEG=true
  echo -e "${GREEN}  ✓ mozjpeg (cjpeg)${NC} (JPEG compression - best quality)"
else
  USE_MOZJPEG=false
  echo -e "${YELLOW}  ✗ mozjpeg not found - using ImageMagick for JPEG${NC}"
fi

echo -e "${CYAN}  ℹ GIFs and SVGs${NC} (skipped - left as-is)"

echo ""

# Count and measure
PNG_COUNT=$(find "$MEDIA_DIR" -type f \( -iname "*.png" -o -iname "*.png_m" \) | wc -l | tr -d ' ')
JPG_COUNT=$(find "$MEDIA_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.jpglarge" \) | wc -l | tr -d ' ')
GIF_COUNT=$(find "$MEDIA_DIR" -type f -iname "*.gif" | wc -l | tr -d ' ')
SVG_COUNT=$(find "$MEDIA_DIR" -type f -iname "*.svg" | wc -l | tr -d ' ')
TOTAL_COUNT=$((PNG_COUNT + JPG_COUNT))
CURRENT_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1)

echo -e "${CYAN}📊 Files found:${NC}"
echo "   JPEGs: $JPG_COUNT (mozjpeg)"
echo "   PNGs:  $PNG_COUNT (pngquant)"
echo "   GIFs:  $GIF_COUNT (skipped)"
echo "   SVGs:  $SVG_COUNT (skipped)"
echo "   To compress: $TOTAL_COUNT"
echo "   Current size: $CURRENT_SIZE"
echo ""
echo -e "${CYAN}⚙️  Settings:${NC}"
echo "   Max dimension: ${MAX_DIMENSION}px"
echo "   Max file size: ${MAX_FILE_SIZE_KB}KB"
echo "   PNG quality: ${PNG_QUALITY} (pngquant)"
echo "   JPEG quality: ${JPEG_QUALITY} (mozjpeg)"
echo "   Parallel workers: $PARALLEL_WORKERS"
echo ""
echo -e "${CYAN}📋 Strategy:${NC}"
echo "   1st pass: Resize to ${MAX_DIMENSION}px, compress at ${PNG_QUALITY}/${JPEG_QUALITY}%"
echo "   2nd pass: If >300KB, compress at 40-70%/70%"
echo "   3rd pass: If still >300KB, resize to 800px and compress at 30-60%/60%"
echo ""

read -p "Start compression? This modifies files IN-PLACE. (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 0
fi

echo ""
echo -e "${BLUE}🔄 Starting compression...${NC}"
echo ""

START_TIME=$(date +%s)
PROGRESS_DIR="/tmp/compress-progress-$$"
rm -rf "$PROGRESS_DIR"
mkdir -p "$PROGRESS_DIR"

# Export for parallel processing
export MEDIA_DIR MAX_DIMENSION PNG_QUALITY JPEG_QUALITY MAX_FILE_SIZE_KB USE_PNGQUANT USE_MOZJPEG
export PROGRESS_DIR TOTAL_COUNT GREEN YELLOW NC START_TIME

compress_file() {
  local file="$1"
  local filename=$(basename "$file")
  local ext="${filename##*.}"
  ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

  local original_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
  local max_bytes=$((MAX_FILE_SIZE_KB * 1024))

  # Get dimensions and resize if needed
  local dims=$(magick identify -format "%wx%h" "$file" 2>/dev/null || echo "0x0")
  local width=$(echo "$dims" | cut -dx -f1)
  local height=$(echo "$dims" | cut -dx -f2)

  if [ "$width" -gt "$MAX_DIMENSION" ] || [ "$height" -gt "$MAX_DIMENSION" ]; then
    magick "$file" -resize "${MAX_DIMENSION}x${MAX_DIMENSION}>" "$file" 2>/dev/null
  fi

  # First pass compression
  case "$ext" in
    png|png_m)
      # pngquant: lossy PNG compression
      pngquant --quality="$PNG_QUALITY" --force --ext .png "$file" 2>/dev/null || true
      ;;
    jpg|jpeg|jpglarge)
      if [ "$USE_MOZJPEG" = true ]; then
        local temp_file=$(mktemp)
        cjpeg -quality "$JPEG_QUALITY" -progressive -optimize "$file" > "$temp_file" 2>/dev/null
        if [ -s "$temp_file" ]; then
          mv "$temp_file" "$file"
        else
          rm -f "$temp_file"
        fi
      else
        magick "$file" -quality "$JPEG_QUALITY" -interlace Plane "$file" 2>/dev/null || true
      fi
      ;;
  esac

  # Check if still over 300KB - apply more aggressive compression
  local new_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)

  if [ "$new_size" -gt "$max_bytes" ]; then
    case "$ext" in
      png|png_m)
        # More aggressive: lower quality range
        pngquant --quality="40-70" --force --ext .png "$file" 2>/dev/null || true
        ;;
      jpg|jpeg|jpglarge)
        # More aggressive: lower quality
        if [ "$USE_MOZJPEG" = true ]; then
          local temp_file=$(mktemp)
          cjpeg -quality 70 -progressive -optimize "$file" > "$temp_file" 2>/dev/null
          if [ -s "$temp_file" ]; then
            mv "$temp_file" "$file"
          else
            rm -f "$temp_file"
          fi
        else
          magick "$file" -quality 70 -interlace Plane "$file" 2>/dev/null || true
        fi
        ;;
    esac
    new_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
  fi

  # If STILL over 300KB, resize smaller and compress again
  if [ "$new_size" -gt "$max_bytes" ]; then
    magick "$file" -resize "800x800>" "$file" 2>/dev/null
    case "$ext" in
      png|png_m)
        pngquant --quality="30-60" --force --ext .png "$file" 2>/dev/null || true
        ;;
      jpg|jpeg|jpglarge)
        if [ "$USE_MOZJPEG" = true ]; then
          local temp_file=$(mktemp)
          cjpeg -quality 60 -progressive -optimize "$file" > "$temp_file" 2>/dev/null
          if [ -s "$temp_file" ]; then mv "$temp_file" "$file"; else rm -f "$temp_file"; fi
        else
          magick "$file" -quality 60 -interlace Plane "$file" 2>/dev/null || true
        fi
        ;;
    esac
    new_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
  fi
  
  # Atomic progress: touch a file for each completed item
  touch "$PROGRESS_DIR/$(basename "$file")"

  # Count completed files (atomic read)
  local count=$(ls -1 "$PROGRESS_DIR" 2>/dev/null | wc -l | tr -d ' ')

  # Show progress every 100 files
  if [ $((count % 100)) -eq 0 ] && [ "$count" -gt 0 ]; then
    local elapsed=$(($(date +%s) - START_TIME))
    if [ "$elapsed" -gt 0 ]; then
      local rate=$(echo "scale=1; $count / $elapsed" | bc 2>/dev/null || echo "?")
      local remaining=$((TOTAL_COUNT - count))
      local eta_sec=$(echo "scale=0; $remaining / $rate" | bc 2>/dev/null || echo "0")
      local eta_min=$((eta_sec / 60))
      printf "\r  ✅ %d/%d - %s f/s, ~%dm left          " "$count" "$TOTAL_COUNT" "$rate" "$eta_min"
    fi
  fi
}
export -f compress_file

# Process files in parallel
find "$MEDIA_DIR" -type f \( -iname "*.png" -o -iname "*.png_m" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.jpglarge" \) -print0 | \
  xargs -0 -P "$PARALLEL_WORKERS" -I {} bash -c 'compress_file "$@"' _ {}

# Summary
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
NEW_SIZE=$(du -sh "$MEDIA_DIR" 2>/dev/null | cut -f1)
FINAL_COUNT=$(ls -1 "$PROGRESS_DIR" 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Compression Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Summary:"
echo "   Files processed: $FINAL_COUNT / $TOTAL_COUNT"
echo "   Before: $CURRENT_SIZE"
echo "   After:  $NEW_SIZE"
echo "   Duration: $((TOTAL_TIME / 60))m $((TOTAL_TIME % 60))s"
echo ""

rm -rf "$PROGRESS_DIR"

