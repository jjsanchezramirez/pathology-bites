'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Button } from "@/shared/components/ui/button"
import { BookOpen, Target, TrendingUp, Play, Award, Trophy } from "lucide-react"
import Link from "next/link"
import { RecentActivity } from "@/features/dashboard/services/service"

interface StudentRecentActivityProps {
  activities: RecentActivity[]
}

export function StudentRecentActivity({ activities }: StudentRecentActivityProps) {
  return (
    <Card className="md:col-span-4">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activities && activities.length > 0 ? (
            activities.map((activity) => {
              const activityContent = (
                <div className={`flex items-center gap-3 rounded-md border p-3 transition-all duration-200 ${
                  activity.navigationUrl ? 'hover:bg-muted/30 hover:border-muted-foreground/30 cursor-pointer' : ''
                }`}>
                  {/* Activity Icons - compact with color coding using theme colors */}
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-muted">
                    {activity.type === 'quiz_completed' && <Award className="h-3.5 w-3.5 text-[hsl(var(--chart-1))]" />}
                    {activity.type === 'study_streak' && <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />}
                    {activity.type === 'quiz_started' && <Play className="h-3.5 w-3.5 text-[hsl(var(--chart-2))]" />}
                    {activity.type === 'achievement_unlocked' && <Trophy className="h-3.5 w-3.5 text-[hsl(var(--chart-4))]" />}
                    {activity.type === 'performance_milestone' && <Target className="h-3.5 w-3.5 text-muted-foreground" />}
                    {!['quiz_completed', 'study_streak', 'quiz_started', 'achievement_unlocked', 'performance_milestone'].includes(activity.type) &&
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                  </div>

                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    {activity.score !== undefined && (
                      <div className={`text-sm font-semibold px-2 py-0.5 rounded ${
                        activity.score >= 80 ? 'text-[hsl(var(--chart-1))]' :
                        activity.score >= 60 ? 'text-[hsl(var(--chart-4))]' :
                        'text-[hsl(var(--chart-5))]'
                      }`}>
                        {activity.score}%
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{activity.timestamp}</div>
                  </div>
                </div>
              )

              // Return either a Link or div based on whether navigationUrl exists
              return activity.navigationUrl ? (
                <Link key={activity.id} href={activity.navigationUrl} className="block">
                  {activityContent}
                </Link>
              ) : (
                <div key={activity.id}>
                  {activityContent}
                </div>
              )
            })
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recent activity. Start a quiz to see your progress!</p>
              <Link href="/dashboard/quiz/new" className="inline-block mt-2">
                <Button size="sm">Start Your First Quiz</Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function StudentRecentActivityLoading() {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-4 p-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

