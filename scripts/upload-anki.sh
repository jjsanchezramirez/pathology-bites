#!/bin/bash
# Upload Anki media files to R2 with compression
# Usage: ./scripts/upload-anki.sh

set -e

echo "🎴 Anki Media Upload Script"
echo "============================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if anki/media directory exists
if [ ! -d "anki/media" ]; then
  echo -e "${RED}❌ Error: anki/media directory not found${NC}"
  echo ""
  echo "Please ensure you have:"
  echo "  1. Exported your Anki deck using CrowdAnki"
  echo "  2. Placed the export in the 'anki/' directory"
  echo "  3. Renamed 'media_files' to 'media' if needed"
  echo ""
  echo "Expected structure:"
  echo "  anki/"
  echo "  ├── ankoma.json (or your deck name)"
  echo "  └── media/"
  echo "      ├── image1.png"
  echo "      └── ..."
  exit 1
fi

# Check if server is running
echo -e "${BLUE}📡 Checking if dev server is running...${NC}"
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${RED}❌ Dev server is not running${NC}"
  echo ""
  echo "Please start the server first:"
  echo "  npm run dev"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Dev server is running${NC}"
echo ""

# Count files
FILE_COUNT=$(find anki/media -type f | wc -l | tr -d ' ')
echo -e "${BLUE}📁 Found $FILE_COUNT files in anki/media${NC}"
echo ""

# Preview upload
echo -e "${BLUE}🔍 Previewing upload...${NC}"
PREVIEW=$(curl -s http://localhost:3000/api/media/r2/upload-anki-media)
TOTAL_SIZE=$(echo "$PREVIEW" | jq -r '.totalSizeMB // "Unknown"')
TOTAL_FILES=$(echo "$PREVIEW" | jq -r '.totalFiles // 0')

if [ "$TOTAL_FILES" = "0" ]; then
  echo -e "${RED}❌ No files found to upload${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Preview successful${NC}"
echo "   Files to upload: $TOTAL_FILES"
echo "   Total size: ${TOTAL_SIZE} MB (before compression)"
echo ""

# Confirm upload
echo -e "${YELLOW}⚠️  This will upload and compress all media files to R2${NC}"
echo -e "${YELLOW}   Existing files with the same name will be REPLACED${NC}"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Upload cancelled${NC}"
  exit 0
fi

# Start upload
echo ""
echo -e "${BLUE}📤 Starting upload with compression...${NC}"
echo "   This may take several minutes depending on file count and size"
echo ""

START_TIME=$(date +%s)

# Perform upload and capture output
UPLOAD_RESULT=$(curl -s -X POST http://localhost:3000/api/media/r2/upload-anki-media)

# Parse results
SUCCESS=$(echo "$UPLOAD_RESULT" | jq -r '.success')
UPLOADED=$(echo "$UPLOAD_RESULT" | jq -r '.uploadedFiles')
FAILED=$(echo "$UPLOAD_RESULT" | jq -r '.failedFiles')
ORIGINAL_SIZE=$(echo "$UPLOAD_RESULT" | jq -r '.totalSize')
COMPRESSED_SIZE=$(echo "$UPLOAD_RESULT" | jq -r '.uploadedSize')
COMPRESSION_RATIO=$(echo "$UPLOAD_RESULT" | jq -r '.compressionRatio')

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Calculate savings
ORIGINAL_MB=$(echo "scale=2; $ORIGINAL_SIZE / 1024 / 1024" | bc)
COMPRESSED_MB=$(echo "scale=2; $COMPRESSED_SIZE / 1024 / 1024" | bc)
SAVINGS_PERCENT=$(echo "scale=1; (1 - $COMPRESSION_RATIO) * 100" | bc)

echo ""
echo "=================================="
if [ "$SUCCESS" = "true" ]; then
  echo -e "${GREEN}✅ Upload completed successfully!${NC}"
else
  echo -e "${RED}❌ Upload completed with errors${NC}"
fi
echo "=================================="
echo ""
echo "📊 Summary:"
echo "   Files uploaded: $UPLOADED"
if [ "$FAILED" != "0" ]; then
  echo -e "   ${RED}Failed: $FAILED${NC}"
fi
echo "   Original size: ${ORIGINAL_MB} MB"
echo "   Compressed size: ${COMPRESSED_MB} MB"
echo "   Compression: ${SAVINGS_PERCENT}% reduction"
echo "   Duration: ${DURATION}s"
echo ""

if [ "$FAILED" != "0" ]; then
  echo -e "${YELLOW}⚠️  Some files failed to upload. Check the logs above.${NC}"
  echo ""
fi

# Remind about JSON upload
echo -e "${BLUE}📝 Next steps:${NC}"
echo ""
echo "1. Upload the JSON file to R2:"
echo "   ${GREEN}wrangler r2 object put pathology-bites-images/anki/ankoma.json \\${NC}"
echo "   ${GREEN}     --file=anki/ankoma.json \\${NC}"
echo "   ${GREEN}     --content-type=\"application/json\"${NC}"
echo ""
echo "2. Test in the application:"
echo "   ${BLUE}http://localhost:3000/dashboard/anki${NC}"
echo ""
echo "3. Clear browser cache and hard refresh (Cmd+Shift+R)"
echo ""

if [ "$SUCCESS" = "true" ] && [ "$FAILED" = "0" ]; then
  echo -e "${GREEN}🎉 All done! Your Anki media is ready.${NC}"
else
  echo -e "${YELLOW}⚠️  Please review any errors before proceeding.${NC}"
fi
