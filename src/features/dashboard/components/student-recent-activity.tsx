"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { BookOpen, Target, TrendingUp, Play, Award, Trophy, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface StudentRecentActivityProps {
  activities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    timeGroup?: string;
    score?: number;
    navigationUrl?: string;
  }>;
}

export function StudentRecentActivity({ activities }: StudentRecentActivityProps) {
  // Helper function to get navigation URL for different activity types
  const getNavigationUrl = (
    activity: StudentRecentActivityProps["activities"][number]
  ): string | undefined => {
    if (activity.navigationUrl) {
      // Fix achievements link to go to dashboard achievements
      if (activity.type === "achievement_unlocked") {
        return "/dashboard/achievements/";
      }
      return activity.navigationUrl;
    }

    // Default navigation based on activity type
    switch (activity.type) {
      case "quiz_completed":
        return `/dashboard/quiz/${activity.id}/results`;
      case "quiz_started":
        return `/dashboard/quiz/${activity.id}`;
      case "achievement_unlocked":
        return "/dashboard/achievements/";
      default:
        return undefined;
    }
  };

  // Helper function to get button text and action for quiz activities
  const getQuizAction = (activity: StudentRecentActivityProps["activities"][number]) => {
    if (activity.type === "quiz_completed") {
      return { text: "Review", variant: "outline" as const };
    }
    if (activity.type === "quiz_started") {
      return { text: "Continue", variant: "default" as const };
    }
    return null;
  };

  return (
    <Card className="md:col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[hsl(var(--chart-1))]" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activities && activities.length > 0 ? (
            activities.map((activity) => {
              const navigationUrl = getNavigationUrl(activity);
              const quizAction = getQuizAction(activity);

              const activityContent = (
                <div
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-all duration-200 ${
                    activity.type === "quiz_started" ? "bg-[hsl(var(--chart-2))]/5" : ""
                  } ${
                    navigationUrl
                      ? "hover:bg-muted/50 hover:border-[hsl(var(--chart-1))]/30 cursor-pointer"
                      : ""
                  }`}
                >
                  {/* Activity Icons - using theme accent colors */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[hsl(var(--muted))]">
                    {activity.type === "quiz_completed" && (
                      <Award className="h-4 w-4 text-[hsl(var(--chart-1))]" />
                    )}
                    {activity.type === "study_streak" && (
                      <TrendingUp className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                    )}
                    {activity.type === "quiz_started" && (
                      <Play className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                    )}
                    {activity.type === "achievement_unlocked" && (
                      <Trophy className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                    )}
                    {activity.type === "performance_milestone" && (
                      <Target className="h-4 w-4 text-[hsl(var(--chart-5))]" />
                    )}
                    {![
                      "quiz_completed",
                      "study_streak",
                      "quiz_started",
                      "achievement_unlocked",
                      "performance_milestone",
                    ].includes(activity.type) && (
                      <BookOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium leading-tight truncate">{activity.title}</p>
                      {/* Score display - inline with title */}
                      {activity.score !== undefined && (
                        <span
                          className={`text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
                            activity.score >= 80
                              ? "text-[hsl(var(--chart-1))] bg-[hsl(var(--chart-1))]/10"
                              : activity.score >= 60
                                ? "text-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/10"
                                : "text-[hsl(var(--chart-5))] bg-[hsl(var(--chart-5))]/10"
                          }`}
                        >
                          Score {activity.score}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {activity.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quiz action button */}
                    {quizAction && navigationUrl && (
                      <Link href={navigationUrl}>
                        <Button
                          size="sm"
                          variant={quizAction.variant}
                          className="h-7 px-3 text-xs border-0"
                        >
                          {quizAction.text}
                        </Button>
                      </Link>
                    )}

                    {/* Timestamp */}
                    <div className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                      {format(new Date(activity.timestamp), "MMM d")}
                    </div>
                  </div>
                </div>
              );

              // Return either a Link or div based on whether navigationUrl exists and if there's no quiz action button
              // If there's a quiz action button, don't wrap in outer Link to avoid nested links
              if (navigationUrl && !quizAction) {
                return (
                  <Link key={activity.id} href={navigationUrl} className="block">
                    {activityContent}
                  </Link>
                );
              }

              return (
                <div
                  key={activity.id}
                  className={navigationUrl ? "cursor-pointer" : ""}
                  onClick={() => navigationUrl && window.location.assign(navigationUrl)}
                >
                  {activityContent}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50" />
              <p className="text-[hsl(var(--muted-foreground))] mb-2">
                No recent activity. Start a quiz to see your progress!
              </p>
              <Link href="/dashboard/quiz/new" className="inline-block mt-2">
                <Button size="sm">Start Your First Quiz</Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentRecentActivityLoading() {
  return (
    <Card className="md:col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
