'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import {
  BookOpen,
  TrendingUp,
  Plus,
  BarChart3,
  Microscope,
  Library,
  ClipboardList,
} from "lucide-react"
import Link from "next/link"

export function StudentQuickActions() {
  return (
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

        <Link href="/dashboard/performance" className="block">
          <Button variant="outline" className="w-full justify-between">
            View Performance
            <BarChart3 className="h-4 w-4" />
          </Button>
        </Link>

        <Link href="/dashboard/quizzes" className="block">
          <Button variant="outline" className="w-full justify-between">
            My Quizzes
            <ClipboardList className="h-4 w-4" />
          </Button>
        </Link>

        <div className="relative">
          <Link href="/dashboard/wsi-questions" className="block">
            <Button variant="outline" className="w-full justify-between">
              Slide-Based Questions
              <Microscope className="h-4 w-4" />
            </Button>
          </Link>
          <span className="absolute -top-2 -right-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            New
          </span>
        </div>

        <div className="relative">
          <Link href="/dashboard/anki" className="block">
            <Button variant="outline" className="w-full justify-between">
              Ankoma Deck Viewer
              <Library className="h-4 w-4" />
            </Button>
          </Link>
          <span className="absolute -top-2 -right-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            New
          </span>
        </div>

        <div className="relative">
          <Button
            variant="outline"
            className="w-full justify-between opacity-50 cursor-not-allowed"
            disabled
          >
            My Progress
            <TrendingUp className="h-4 w-4" />
          </Button>
          <span className="absolute -top-2 -right-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            Soon
          </span>
        </div>

        <div className="relative">
          <Button
            variant="outline"
            className="w-full justify-between opacity-50 cursor-not-allowed"
            disabled
          >
            Learning Modules
            <BookOpen className="h-4 w-4" />
          </Button>
          <span className="absolute -top-2 -right-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            Soon
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function StudentQuickActionsLoading() {
  return (
    <Card className="md:col-span-3">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

