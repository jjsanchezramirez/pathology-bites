'use client'

import { useEffect, useState } from "react"
import { clientDashboardService } from "@/features/dashboard/services/client-service"
import { DashboardStats, RecentActivity } from "@/features/dashboard/services/service"
import { StatsCards } from "@/shared/components/layout/dashboard/stats-cards"
import { RecentActivityCard } from "@/shared/components/layout/dashboard/recent-activity"
import { QuickActionsCard } from "@/shared/components/layout/dashboard/quick-actions"
import { SystemStatus } from "@/shared/components/layout/dashboard/system-status"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"

// Loading components
function StatsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3">
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminDashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<RecentActivity[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch dashboard stats and activities in parallel
        const [dashboardStats, recentActivities] = await Promise.all([
          clientDashboardService.getDashboardStats(),
          clientDashboardService.getRecentActivity()
        ])

        setStats(dashboardStats)
        setActivities(recentActivities)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload()
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !stats || !activities) {
    return (
      <div className="space-y-6">
        <StatsLoading />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <ActivityLoading />
          <ActionsLoading />
        </div>
      </div>
    )
  }

  const quickActions = clientDashboardService.getQuickActions(stats)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Main Content Area */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        <RecentActivityCard activities={activities} />

        {/* Quick Actions */}
        <QuickActionsCard actions={quickActions} />
      </div>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Placeholder for future dashboard widgets */}
          <div className="h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Additional dashboard widgets coming soon</p>
          </div>
        </div>
        <SystemStatus />
      </div>
    </div>
  )
}
