// src/features/progress/components/progress-hero.tsx

import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { TrendingUp } from 'lucide-react'

export function ProgressHero() {
  return (
    <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
      <CardContent className="p-12 text-center">
        <TrendingUp className="h-16 w-16 text-purple-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-purple-900 mb-4">
          Progress Tracking In Development
        </h2>
        <p className="text-purple-700 mb-6 max-w-2xl mx-auto">
          We're building a comprehensive progress tracking system to help you monitor your learning journey, 
          track milestones, view learning streaks, and celebrate achievements. This will include detailed 
          analytics of your study patterns and personalized insights for improvement.
        </p>
        <Badge variant="secondary" className="mb-4">
          Launching Soon
        </Badge>
      </CardContent>
    </Card>
  )
}

