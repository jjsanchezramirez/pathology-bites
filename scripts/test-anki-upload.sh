#!/bin/bash
# Test script for Anki upload functionality
# Creates dummy files to test compression and upload

set -e

echo "🧪 Anki Upload Test Script"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create test directory
TEST_DIR="anki-test"
MEDIA_DIR="$TEST_DIR/media"

echo -e "${BLUE}📁 Creating test directory structure...${NC}"
rm -rf "$TEST_DIR"
mkdir -p "$MEDIA_DIR"

# Create test JSON
echo -e "${BLUE}📝 Creating test deck JSON...${NC}"
cat > "$TEST_DIR/test-deck.json" << 'EOF'
{
  "__type__": "Deck",
  "name": "Test Deck",
  "children": [
    {
      "__type__": "Deck",
      "name": "Test Subdeck",
      "notes": [
        {
          "__type__": "Note",
          "guid": "test-123",
          "note_model_uuid": "cb0c02c4-e328-11ef-a4df-cf9f22b82781",
          "fields": ["Header", "{{c1::Test}}", "Extra"],
          "tags": ["test"]
        }
      ]
    }
  ]
}
EOF

# Create test images using ImageMagick or native tools
echo -e "${BLUE}🖼️  Creating test images...${NC}"

# PNG test image (simulating a screenshot)
convert -size 800x600 xc:white \
  -fill black -pointsize 30 -gravity center -annotate +0+0 'Test PNG Image' \
  "$MEDIA_DIR/test-image-1.png" 2>/dev/null || {
    # Fallback if ImageMagick not installed
    echo "ImageMagick not found, using curl to download test images..."
    curl -s "https://via.placeholder.com/800x600/FFFFFF/000000?text=Test+PNG+1" > "$MEDIA_DIR/test-image-1.png"
  }

# JPEG test image
convert -size 1200x900 xc:lightblue \
  -fill darkblue -pointsize 40 -gravity center -annotate +0+0 'Test JPEG Image' \
  "$MEDIA_DIR/test-image-2.jpg" 2>/dev/null || {
    curl -s "https://via.placeholder.com/1200x900/ADD8E6/00008B?text=Test+JPEG+2" > "$MEDIA_DIR/test-image-2.jpg"
  }

# Large image to test resizing
convert -size 3200x2400 xc:lightyellow \
  -fill darkorange -pointsize 50 -gravity center -annotate +0+0 'Large Image (Should Resize)' \
  "$MEDIA_DIR/test-large-image.png" 2>/dev/null || {
    curl -s "https://via.placeholder.com/3200x2400/FFFFE0/FF8C00?text=Large+Image" > "$MEDIA_DIR/test-large-image.png"
  }

# SVG test file
cat > "$MEDIA_DIR/test-diagram.svg" << 'EOF'
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="white" stroke="black" stroke-width="2"/>
  <circle cx="200" cy="150" r="50" fill="lightcoral"/>
  <text x="200" y="250" text-anchor="middle" font-size="20">Test SVG</text>
</svg>
EOF

echo -e "${GREEN}✅ Created test files:${NC}"
ls -lh "$MEDIA_DIR"
echo ""

# Calculate total size
TOTAL_SIZE=$(du -sh "$MEDIA_DIR" | cut -f1)
echo -e "${BLUE}📊 Total test size: $TOTAL_SIZE${NC}"
echo ""

# Temporarily move real anki directory if it exists
if [ -d "anki" ]; then
  echo -e "${YELLOW}⚠️  Moving existing anki/ directory to anki.backup${NC}"
  mv anki anki.backup
fi

# Move test directory to expected location
mv "$TEST_DIR" anki

echo -e "${BLUE}🚀 Testing upload API...${NC}"
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${RED}❌ Dev server is not running${NC}"
  echo "Please start it with: npm run dev"
  echo ""
  echo "To clean up test files:"
  echo "  rm -rf anki"
  if [ -d "anki.backup" ]; then
    echo "  mv anki.backup anki"
  fi
  exit 1
fi

# Preview
echo -e "${BLUE}1️⃣  Testing GET (preview)...${NC}"
PREVIEW_RESULT=$(curl -s http://localhost:3000/api/media/r2/upload-anki-media)
echo "$PREVIEW_RESULT" | jq '.' || echo "$PREVIEW_RESULT"
echo ""

# Upload
echo -e "${BLUE}2️⃣  Testing POST (upload with compression)...${NC}"
echo "This will upload test files to R2 (anki-test/* namespace)"
echo ""

read -p "Continue with upload test? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  UPLOAD_RESULT=$(curl -s -X POST http://localhost:3000/api/media/r2/upload-anki-media)
  echo "$UPLOAD_RESULT" | jq '.' || echo "$UPLOAD_RESULT"

  # Extract metrics
  COMPRESSED_RATIO=$(echo "$UPLOAD_RESULT" | jq -r '.compressionRatio')
  if [ "$COMPRESSED_RATIO" != "null" ]; then
    SAVINGS=$(echo "scale=1; (1 - $COMPRESSED_RATIO) * 100" | bc)
    echo ""
    echo -e "${GREEN}✅ Compression test completed${NC}"
    echo -e "   Compression ratio: ${COMPRESSED_RATIO}"
    echo -e "   Savings: ${SAVINGS}%"
  fi
else
  echo -e "${YELLOW}Upload test skipped${NC}"
fi

echo ""
echo -e "${BLUE}🧹 Cleanup${NC}"
echo ""
echo "Test files are in anki/ directory"
echo ""
echo "To clean up:"
echo "  rm -rf anki"
if [ -d "anki.backup" ]; then
  echo "  mv anki.backup anki"
fi
echo ""
echo "Or keep testing and manually inspect:"
echo "  ls -lh anki/media"
echo "  cat anki/test-deck.json"
echo ""
