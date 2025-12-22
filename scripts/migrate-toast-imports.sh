#!/bin/bash

# Script to migrate toast imports from 'sonner' to '@/shared/utils/toast'
# This ensures all files use the standardized toast utility with duplicate prevention

echo "🔄 Migrating toast imports to standardized utility..."

# Counter for tracking changes
count=0

# Find all TypeScript/TSX files importing from 'sonner'
# Exclude the toast utility file itself and node_modules
files=$(grep -rl "from ['\"]sonner['\"]" src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude="toast.ts" \
  --exclude="sonner.tsx" \
  2>/dev/null || true)

if [ -z "$files" ]; then
  echo "✅ No files found that need migration"
  exit 0
fi

echo "📝 Found $(echo "$files" | wc -l) files to migrate"
echo ""

# Process each file
for file in $files; do
  # Check if file imports toast from sonner (not just sonner types)
  if grep -q "import.*toast.*from ['\"]sonner['\"]" "$file" 2>/dev/null; then
    echo "  🔧 Migrating: $file"

    # Use sed to replace the import
    # Handle both single and double quotes
    sed -i '' \
      -e "s|import { toast } from ['\"]sonner['\"]|import { toast } from '@/shared/utils/toast'|g" \
      -e "s|import { toast } from 'sonner'|import { toast } from '@/shared/utils/toast'|g" \
      -e 's|import { toast } from "sonner"|import { toast } from "@/shared/utils/toast"|g' \
      "$file"

    ((count++))
  fi
done

echo ""
echo "✅ Migration complete!"
echo "   Migrated $count files"
echo ""
echo "📋 Next steps:"
echo "   1. Review the changes: git diff"
echo "   2. Test the application thoroughly"
echo "   3. Run: npm run build (to verify no TypeScript errors)"
echo "   4. Commit the changes"
