// src/app/(dashboard)/dashboard/goals/page.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { 
  Target, 
  Plus, 
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp
} from "lucide-react"

export default function GoalsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Goals</h1>
          <p className="text-muted-foreground">
            Set and track your learning objectives
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Current Goals */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Weekly Quiz Goal
              </CardTitle>
              <Badge variant="secondary">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Complete 50 questions this week</span>
              <span>32/50 questions</span>
            </div>
            <Progress value={64} className="w-full" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>3 days remaining</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                <span>On track</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Renal Pathology Mastery
              </CardTitle>
              <Badge variant="outline">In Progress</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Achieve 90% accuracy in Renal Pathology</span>
              <span>78% current</span>
            </div>
            <Progress value={78} className="w-full" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>No deadline</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                <span>12% to go</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Study Streak Challenge
              </CardTitle>
              <Badge className="bg-green-100 text-green-800">Completed</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Study for 7 consecutive days</span>
              <span>7/7 days</span>
            </div>
            <Progress value={100} className="w-full" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Completed 5 days ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle>Suggested Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Daily Practice</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Answer 10 questions every day for a month
              </p>
              <Button variant="outline" size="sm">
                Set Goal
              </Button>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Category Mastery</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Achieve 85% accuracy in Dermatopathology
              </p>
              <Button variant="outline" size="sm">
                Set Goal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
