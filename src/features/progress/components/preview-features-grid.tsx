// src/features/progress/components/preview-features-grid.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import {
  Calendar,
  Trophy,
  Clock,
  Star,
  Zap,
  CheckCircle
} from 'lucide-react'

export function PreviewFeaturesGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card className="opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-green-500" />
            Learning Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Track your daily study streaks and maintain consistency in 
            your pathology learning journey.
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current streak:</span>
            <Badge variant="outline">12 days</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Celebrate major learning milestones and track your progress 
            through different pathology topics.
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Next milestone:</span>
            <Badge variant="outline">100 questions</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-blue-500" />
            Study Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Monitor total time spent learning and track your dedication 
            to mastering pathology concepts.
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total time:</span>
            <Badge variant="outline">47 hours</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-orange-500" />
            Achievement Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Unlock achievement badges as you reach study goals and 
            demonstrate mastery in various areas.
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Badges earned:</span>
            <Badge variant="outline">8 badges</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-red-500" />
            Learning Velocity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Track your learning pace and see how your study speed 
            improves over time.
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">This week:</span>
            <Badge variant="outline">+15% faster</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-purple-500" />
            Module Completion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Monitor completion rates across different learning modules 
            and track your overall progress.
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall progress:</span>
            <Badge variant="outline">34%</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

