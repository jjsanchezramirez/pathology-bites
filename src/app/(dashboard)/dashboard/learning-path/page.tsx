// src/app/(dashboard)/dashboard/learning-path/page.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { 
  BookOpen, 
  CheckCircle, 
  Circle,
  Lock,
  Play,
  Star,
  Clock,
  Target
} from "lucide-react"

export default function LearningPathPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Path</h1>
        <p className="text-muted-foreground">
          Follow a structured curriculum designed for pathology mastery
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Pathology Fundamentals Track</span>
            <span>3/8 modules completed</span>
          </div>
          <Progress value={37.5} className="w-full" />
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>~15 hours remaining</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              <span>Beginner to Intermediate</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Modules */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Learning Modules</h2>
        
        <div className="grid gap-4">
          {/* Completed Module */}
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">1. Introduction to Pathology</h3>
                    <Badge className="bg-green-100 text-green-800">Completed</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Basic concepts, terminology, and overview of pathological processes
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span>25 questions • 2 hours</span>
                    <span className="text-green-600">Score: 92%</span>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Review
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Completed Module */}
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">2. Cell Injury and Death</h3>
                    <Badge className="bg-green-100 text-green-800">Completed</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Mechanisms of cellular damage, adaptation, and death
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span>30 questions • 2.5 hours</span>
                    <span className="text-green-600">Score: 88%</span>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Review
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Module */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <Circle className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">3. Inflammation and Repair</h3>
                    <Badge variant="secondary">In Progress</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Acute and chronic inflammation, wound healing, and tissue repair
                  </p>
                  <div className="flex items-center gap-4 text-sm mb-3">
                    <span>35 questions • 3 hours</span>
                    <span>Progress: 12/35 questions</span>
                  </div>
                  <Progress value={34} className="w-full mb-3" />
                </div>
                <Button size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Modules */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <Circle className="h-6 w-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-600">4. Hemodynamic Disorders</h3>
                    <Badge variant="outline">Upcoming</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Edema, hyperemia, congestion, hemorrhage, and thrombosis
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span>28 questions • 2.5 hours</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Locked
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <Lock className="h-6 w-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-600">5. Genetic Disorders</h3>
                    <Badge variant="outline">Locked</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Mendelian disorders, chromosomal abnormalities, and genetic testing
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span>32 questions • 3 hours</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  <Lock className="h-4 w-4 mr-2" />
                  Locked
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Continue with Inflammation module</p>
                <p className="text-sm text-muted-foreground">You're making good progress! Complete 5 more questions to unlock the next section.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
              <Target className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Review Cell Injury concepts</p>
                <p className="text-sm text-muted-foreground">Your recent quiz showed some gaps in apoptosis mechanisms. Consider reviewing this topic.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
