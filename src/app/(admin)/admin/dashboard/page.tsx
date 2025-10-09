// src/app/(admin)/admin/dashboard/page.tsx
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
import { useUserRole } from "@/shared/hooks/use-user-role"
import { useAuthStatus } from "@/features/auth/hooks/use-auth-status"

export default function AdminDashboardPage() {
  const { role, isLoading: roleLoading } = useUserRole()
  const { user } = useAuthStatus()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<RecentActivity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Don't fetch until role is loaded
    if (roleLoading || role === undefined) {
      return
    }

    async function fetchDashboardData() {
      try {
        setError(null)

        // Fetch dashboard stats and activities in parallel
        const [dashboardStats, recentActivities] = await Promise.all([
          clientDashboardService.getDashboardStats(),
          clientDashboardService.getRecentActivity(role || undefined, user?.id)
        ])

        setStats(dashboardStats)
        setActivities(recentActivities)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      }
    }

    fetchDashboardData()
  }, [role, roleLoading, user?.id])

  const quickActions = stats ? clientDashboardService.getQuickActions(stats, role || undefined) : []

  // Single loading state - show skeleton until ALL data is ready
  const isLoading = roleLoading || !stats || !activities

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Administrative overview and system management.
        </p>
      </div>

      {error ? (
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
      ) : isLoading ? (
        <>
          {/* Stats Loading */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
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

          {/* Activity and Actions Loading */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
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
          </div>
        </>
      ) : (
        <>
          {/* Stats Cards */}
          <StatsCards stats={stats} />

          {/* Main Content Area */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Recent Activity */}
            <RecentActivityCard activities={activities} />

            {/* Quick Actions */}
            <QuickActionsCard actions={quickActions} />
          </div>

          {/* System Status - Expanded */}
          <SystemStatus />
        </>
      )}
    </div>
  )
}