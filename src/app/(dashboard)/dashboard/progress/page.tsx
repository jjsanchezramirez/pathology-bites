// src/app/(dashboard)/dashboard/progress/page.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import {
  TrendingUp,
  Calendar,
  Trophy,
  BarChart3,
  Clock,
  Star,
  Zap,
  CheckCircle,
  Settings
} from "lucide-react"
import Link from "next/link"
import { FeaturePlaceholder } from "@/features/dashboard/components"
import { isQuizFeaturesEnabled } from "@/shared/config/feature-flags"

export default function ProgressPage() {
  const featuresEnabled = isQuizFeaturesEnabled()

  // Show placeholder if features are disabled
  if (!featuresEnabled) {
    return (
      <FeaturePlaceholder
        title="Progress Tracking"
        description="Structured learning paths are being built to guide your pathology education journey. Soon you'll be able to track your learning milestones, maintain study streaks, monitor module completion rates, and celebrate your achievements."
        status="coming-very-soon"
      />
    )
  }
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">
          Track your learning journey, milestones, and personal growth
        </p>
      </div>

      {/* Coming Soon Hero */}
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

      {/* Progress vs Performance Explanation */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <TrendingUp className="h-5 w-5" />
              Progress Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-700 mb-4">
              <strong>Progress</strong> focuses on your learning journey over time - tracking milestones, 
              study streaks, module completion, and personal growth metrics.
            </p>
            <ul className="text-sm text-purple-600 space-y-1">
              <li>• Learning milestones and achievements</li>
              <li>• Study streaks and consistency</li>
              <li>• Module and lesson completion rates</li>
              <li>• Time spent learning</li>
              <li>• Personal growth over time</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <BarChart3 className="h-5 w-5" />
              Performance Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700 mb-4">
              <strong>Performance</strong> focuses on your competency and accuracy - analyzing quiz results, 
              identifying knowledge gaps, and measuring mastery of pathology topics.
            </p>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• Quiz scores and accuracy trends</li>
              <li>• Knowledge gaps analysis</li>
              <li>• Topic mastery levels</li>
              <li>• Comparative performance metrics</li>
              <li>• Areas needing improvement</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Preview Features */}
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

      {/* Temporary Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            In the Meantime
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            While we're building the Progress feature, you can still track your learning using these existing tools:
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/performance">
              <Button variant="outline" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                View Performance Analytics
              </Button>
            </Link>
            <Link href="/dashboard/quizzes">
              <Button variant="outline" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Review Quiz History
              </Button>
            </Link>
            <Link href="/dashboard/learning">
              <Button variant="outline" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Continue Learning Modules
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
