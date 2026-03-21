"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import {
  BookOpen,
  TrendingUp,
  Plus,
  BarChart3,
  Microscope,
  Library,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";

export function StudentQuickActions() {
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Link href="/dashboard/quiz/new" className="block">
          <Button className="w-full justify-between text-sm">
            Start New Quiz
            <Plus className="h-4 w-4 shrink-0" />
          </Button>
        </Link>

        <Link href="/dashboard/performance" className="block">
          <Button variant="outline" className="w-full justify-between text-sm">
            View Performance
            <BarChart3 className="h-4 w-4 shrink-0" />
          </Button>
        </Link>

        <Link href="/dashboard/quizzes" className="block">
          <Button variant="outline" className="w-full justify-between text-sm">
            My Quizzes
            <ClipboardList className="h-4 w-4 shrink-0" />
          </Button>
        </Link>

        <Link href="/dashboard/wsi-questions" className="block">
          <Button variant="outline" className="w-full justify-between text-sm">
            <span className="flex items-center gap-2">
              Slide-Based Questions
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full leading-none">
                New
              </span>
            </span>
            <Microscope className="h-4 w-4 shrink-0" />
          </Button>
        </Link>

        <Link href="/dashboard/anki" className="block">
          <Button variant="outline" className="w-full justify-between text-sm">
            <span className="flex items-center gap-2">
              Ankoma Deck Viewer
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full leading-none">
                New
              </span>
            </span>
            <Library className="h-4 w-4 shrink-0" />
          </Button>
        </Link>

        <Button
          variant="outline"
          className="w-full justify-between text-sm opacity-50 cursor-not-allowed"
          disabled
        >
          <span className="flex items-center gap-2">
            My Progress
            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full leading-none">
              Soon
            </span>
          </span>
          <TrendingUp className="h-4 w-4 shrink-0" />
        </Button>

        <Button
          variant="outline"
          className="w-full justify-between text-sm opacity-50 cursor-not-allowed"
          disabled
        >
          <span className="flex items-center gap-2">
            Learning Modules
            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full leading-none">
              Soon
            </span>
          </span>
          <BookOpen className="h-4 w-4 shrink-0" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function StudentQuickActionsLoading() {
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
