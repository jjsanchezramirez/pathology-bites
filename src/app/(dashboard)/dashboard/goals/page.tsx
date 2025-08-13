// src/app/(dashboard)/dashboard/goals/page.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import {
  Target,
  Calendar,
  Trophy,
  TrendingUp,
  Clock,
  Star,
  Zap,
  CheckCircle,
  Settings
} from "lucide-react"
import Link from "next/link"

export default function GoalsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Goals</h1>
        <p className="text-muted-foreground">
          Set and track your learning objectives and study targets
        </p>
      </div>

      {/* Coming Soon Hero */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-12 text-center">
          <Target className="h-16 w-16 text-blue-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Goals Feature In Development
          </h2>
          <p className="text-blue-700 mb-6 max-w-2xl mx-auto">
            We're building a comprehensive goal-setting system to help you track your learning progress, 
            set study targets, and achieve your pathology education objectives. This feature will include 
            daily study goals, weekly targets, and long-term learning milestones.
          </p>
          <Badge variant="secondary" className="mb-4">
            Launching Soon
          </Badge>
        </CardContent>
      </Card>

      {/* Preview Features */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="opacity-75">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-green-500" />
              Daily Study Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Set daily question targets and track your study streak. Maintain consistency 
              with personalized daily goals.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Example target:</span>
              <Badge variant="outline">20 questions/day</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Achievement Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Unlock achievements as you progress through different pathology topics 
              and reach study milestones.
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
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Progress Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Monitor your improvement over time with detailed analytics and 
              personalized insights into your learning patterns.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current streak:</span>
              <Badge variant="outline">5 days</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-purple-500" />
              Study Time Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Set weekly study time targets and track how much time you spend 
              learning pathology concepts.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Weekly target:</span>
              <Badge variant="outline">10 hours</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5 text-orange-500" />
              Topic Mastery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Set goals for mastering specific pathology topics with accuracy 
              targets and competency tracking.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Target accuracy:</span>
              <Badge variant="outline">85%</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-75">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-red-500" />
              Challenge Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Take on weekly challenges and compete with yourself to improve 
              performance in specific areas.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">This week:</span>
              <Badge variant="outline">Bone pathology</Badge>
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
            While we're building the Goals feature, you can still track your progress using these existing tools:
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/performance">
              <Button variant="outline" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
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
                <Target className="h-4 w-4" />
                Continue Learning Modules
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}