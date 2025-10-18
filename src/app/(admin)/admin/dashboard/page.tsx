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
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context"

export default function AdminDashboardPage() {
  const { role, isLoading: roleLoading } = useUserRole()
  const { user } = useAuthStatus()
  const { adminMode } = useDashboardTheme()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<RecentActivity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('[AdminDashboard] Effect triggered - role:', role, 'user?.id:', user?.id, 'roleLoading:', roleLoading)

    // Don't fetch until we have a user and role is not loading
    if (!user || roleLoading || role === undefined) {
      console.log('[AdminDashboard] Skipping fetch - waiting for user/role')
      return
    }

    async function fetchDashboardData() {
      try {
        setError(null)
        console.log('[AdminDashboard] 🔄 FETCHING dashboard data for role:', role, 'user:', user?.id)

        // Use adminMode for determining what data to fetch and show
        const effectiveRole = adminMode === 'user' ? 'user' : adminMode

        // Fetch dashboard stats and activities in parallel
        const [dashboardStats, recentActivities] = await Promise.all([
          clientDashboardService.getDashboardStats(),
          clientDashboardService.getRecentActivity(effectiveRole as any, user?.id)
        ])

        setStats(dashboardStats)
        setActivities(recentActivities)
        console.log('[AdminDashboard] ✅ Dashboard data loaded successfully')
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      }
    }

    fetchDashboardData()
  }, [adminMode, user?.id, roleLoading]) // Use adminMode instead of role

  // Use adminMode for determining quick actions
  const effectiveRole = adminMode === 'user' ? 'user' : adminMode
  const quickActions = stats ? clientDashboardService.getQuickActions(stats, effectiveRole as any) : []

  // Single loading state - show skeleton until ALL data is ready
  // Only show loading if we don't have user yet, or if role is still loading, or if we don't have data yet
  const isLoading = !user || roleLoading || !stats || !activities

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {adminMode === 'creator' ? 'Creator Dashboard' :
           adminMode === 'reviewer' ? 'Reviewer Dashboard' :
           adminMode === 'user' ? 'Student Dashboard' : 'Admin Dashboard'}
        </h1>
        <p className="text-muted-foreground">
          {adminMode === 'creator' ? 'Question creation and content management.' :
           adminMode === 'reviewer' ? 'Review queue and question approval.' :
           adminMode === 'user' ? 'Learning progress and quiz performance.' :
           'Administrative overview and system management.'}
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

          {/* System Status - Only show for admin mode */}
          {adminMode === 'admin' && <SystemStatus />}
        </>
      )}
    </div>
  )
}