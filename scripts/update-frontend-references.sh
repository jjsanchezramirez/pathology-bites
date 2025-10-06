#!/bin/bash
# Frontend API Reference Update Script
# Generated automatically - review before executing

echo "🔄 Updating frontend API references..."


# Update references for /api/quiz/sessions → /api/content/quiz/sessions
echo "Updating 10 references for /api/quiz/sessions..."
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/api/quiz/sessions/route.ts"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/api/quiz/sessions/[id]/complete/route.ts"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/api/quiz/sessions/[id]/results/route.ts"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/api/quiz/sessions/[id]/route.ts"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/(dashboard)/dashboard/quiz/new/page.tsx"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/(dashboard)/dashboard/quiz/[id]/results/page.tsx"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/(dashboard)/dashboard/quiz/[id]/review/page.tsx"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/(dashboard)/dashboard/quiz/[id]/page.tsx"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/app/(dashboard)/dashboard/quizzes/page.tsx"
sed -i '' 's|/api/quiz/sessions|/api/content/quiz/sessions|g' "src/features/dashboard/components/welcome-message.tsx"

# Update references for /api/quiz/attempts → /api/content/quiz/attempts
echo "Updating 3 references for /api/quiz/attempts..."
sed -i '' 's|/api/quiz/attempts|/api/content/quiz/attempts|g' "src/app/api/quiz/attempts/batch/route.ts"
sed -i '' 's|/api/quiz/attempts|/api/content/quiz/attempts|g' "src/app/api/quiz/attempts/route.ts"
sed -i '' 's|/api/quiz/attempts|/api/content/quiz/attempts|g' "src/app/api/quiz/attempts/optimized/route.ts"

# Update references for /api/quiz/options → /api/content/quiz/options
echo "Updating 3 references for /api/quiz/options..."
sed -i '' 's|/api/quiz/options|/api/content/quiz/options|g' "src/app/(dashboard)/dashboard/quiz/new/page.tsx"
sed -i '' 's|/api/quiz/options|/api/content/quiz/options|g' "src/features/debug/components/api-tests-tab.tsx"
sed -i '' 's|/api/quiz/options|/api/content/quiz/options|g' "src/shared/hooks/use-optimized-quiz-data.ts"

# Update references for /api/learning → /api/content/learning
echo "Updating 12 references for /api/learning..."
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/api/learning/route.ts"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/api/learning-modules/route.ts"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/api/learning-modules/[id]/progress/route.ts"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/api/learning-modules/[id]/route.ts"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/api/learning-paths/route.ts"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/api/learning-paths/[id]/enroll/route.ts"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/api/learning-paths/[id]/route.ts"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/(dashboard)/dashboard/learning/page.tsx"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/(admin)/admin/learning-modules/[id]/edit/page.tsx"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/app/(admin)/admin/learning-modules/create/page.tsx"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/features/learning-modules/hooks/use-learning-paths.ts"
sed -i '' 's|/api/learning|/api/content/learning|g' "src/features/learning-modules/hooks/use-learning-modules.ts"

# Update references for /api/learning-modules → /api/content/learning
echo "Updating 6 references for /api/learning-modules..."
sed -i '' 's|/api/learning-modules|/api/content/learning|g' "src/app/api/learning-modules/route.ts"
sed -i '' 's|/api/learning-modules|/api/content/learning|g' "src/app/api/learning-modules/[id]/progress/route.ts"
sed -i '' 's|/api/learning-modules|/api/content/learning|g' "src/app/api/learning-modules/[id]/route.ts"
sed -i '' 's|/api/learning-modules|/api/content/learning|g' "src/app/(admin)/admin/learning-modules/[id]/edit/page.tsx"
sed -i '' 's|/api/learning-modules|/api/content/learning|g' "src/app/(admin)/admin/learning-modules/create/page.tsx"
sed -i '' 's|/api/learning-modules|/api/content/learning|g' "src/features/learning-modules/hooks/use-learning-modules.ts"

# Update references for /api/learning-paths → /api/content/learning
echo "Updating 4 references for /api/learning-paths..."
sed -i '' 's|/api/learning-paths|/api/content/learning|g' "src/app/api/learning-paths/route.ts"
sed -i '' 's|/api/learning-paths|/api/content/learning|g' "src/app/api/learning-paths/[id]/enroll/route.ts"
sed -i '' 's|/api/learning-paths|/api/content/learning|g' "src/app/api/learning-paths/[id]/route.ts"
sed -i '' 's|/api/learning-paths|/api/content/learning|g' "src/features/learning-modules/hooks/use-learning-paths.ts"

# Update references for /api/health → /api/public/health
echo "Updating 1 references for /api/health..."
sed -i '' 's|/api/health|/api/public/health|g' "src/app/api/health/route.ts"

# Update references for /api/public/health → /api/public/health
echo "Updating 4 references for /api/public/health..."
sed -i '' 's|/api/public/health|/api/public/health|g' "src/app/api/health/route.ts"
sed -i '' 's|/api/public/health|/api/public/health|g' "src/app/api/public/health/route.ts"
sed -i '' 's|/api/public/health|/api/public/health|g' "src/features/debug/components/api-tests-tab.tsx"
sed -i '' 's|/api/public/health|/api/public/health|g' "src/features/debug/components/database-tab.tsx"

# Update references for /api/subscribe → /api/public/subscribe
echo "Updating 2 references for /api/subscribe..."
sed -i '' 's|/api/subscribe|/api/public/subscribe|g' "src/app/api/subscribe/route.ts"
sed -i '' 's|/api/subscribe|/api/public/subscribe|g' "src/shared/hooks/use-email-subscription.ts"

# Update references for /api/maintenance-notifications → /api/public/maintenance
echo "Updating 2 references for /api/maintenance-notifications..."
sed -i '' 's|/api/maintenance-notifications|/api/public/maintenance|g' "src/app/api/maintenance-notifications/route.ts"
sed -i '' 's|/api/maintenance-notifications|/api/public/maintenance|g' "src/shared/hooks/use-maintenance-notifications.ts"

echo "✅ Frontend references updated!"
echo "🧪 Please test your application thoroughly after these changes."
