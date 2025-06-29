// src/app/(dashboard)/dashboard/page.tsx
"use client"

import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Skeleton } from "@/shared/components/ui/skeleton"
import {
  BookOpen,
  Target,
  TrendingUp,
  Clock,
  Award,
  Brain,
  Play,
  Plus,
  BarChart3,
  Calendar
} from "lucide-react"
import Link from "next/link"

// Loading components
function StatsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ActivityLoading() {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-4 p-3">
              <Skeleton className="h-4 w-4 mt-1" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ActionsLoading() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Mock data - replace with real data fetching
const mockStats = {
  totalQuestions: 1246,
  completedQuestions: 128,
  averageScore: 76,
  studyStreak: 12,
  recentQuizzes: 5,
  weeklyGoal: 50,
  currentWeekProgress: 32
}

const mockRecentActivity = [
  {
    id: 1,
    type: 'quiz_completed',
    title: 'Completed Renal Pathology Quiz',
    description: 'Scored 85% on 20 questions',
    timestamp: '2 hours ago',
    score: 85
  },
  {
    id: 2,
    type: 'study_streak',
    title: 'Study Streak Milestone',
    description: 'Reached 12 days in a row!',
    timestamp: '1 day ago'
  },
  {
    id: 3,
    type: 'quiz_started',
    title: 'Started Dermatopathology Quiz',
    description: 'Progress: 15/30 questions',
    timestamp: '2 days ago'
  }
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Track your progress and continue learning.
        </p>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsLoading />}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Questions Completed</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.completedQuestions}</div>
              <p className="text-xs text-muted-foreground">
                of {mockStats.totalQuestions} total questions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.averageScore}%</div>
              <p className="text-xs text-muted-foreground">
                +5% from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.studyStreak} days</div>
              <p className="text-xs text-muted-foreground">
                Keep it up!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Progress</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.currentWeekProgress}/{mockStats.weeklyGoal}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((mockStats.currentWeekProgress / mockStats.weeklyGoal) * 100)}% of weekly goal
              </p>
            </CardContent>
          </Card>
        </div>
      </Suspense>

      {/* Main Content Area */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        <Suspense fallback={<ActivityLoading />}>
          <Card className="md:col-span-4">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockRecentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 rounded-lg border p-4">
                    {activity.type === 'quiz_completed' && <Award className="h-5 w-5 mt-0.5 text-green-500" />}
                    {activity.type === 'study_streak' && <TrendingUp className="h-5 w-5 mt-0.5 text-blue-500" />}
                    {activity.type === 'quiz_started' && <Play className="h-5 w-5 mt-0.5 text-orange-500" />}
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">{activity.timestamp}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Suspense>

        {/* Quick Actions */}
        <Suspense fallback={<ActionsLoading />}>
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/dashboard/quiz/new" className="block">
                <Button className="w-full justify-between">
                  Start New Quiz
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/dashboard/quiz/tutor" className="block">
                <Button variant="outline" className="w-full justify-between">
                  Tutor Mode
                  <Brain className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/dashboard/performance" className="block">
                <Button variant="outline" className="w-full justify-between">
                  View Performance
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/dashboard/quizzes" className="block">
                <Button variant="outline" className="w-full justify-between">
                  My Quizzes
                  <Clock className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </Suspense>
      </div>
    </div>
  )
}