// src/app/(admin)/admin/dashboard/page.tsx
import { Metadata } from "next"
import { Suspense } from "react"
import { dashboardService } from "@/lib/dashboard/service"
import { StatsCards } from "@/components/admin/dashboard/stats-cards"
import { RecentActivityCard } from "@/components/admin/dashboard/recent-activity"
import { QuickActionsCard } from "@/components/admin/dashboard/quick-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Admin Dashboard - Pathology Bites",
  description: "Administrative dashboard overview",
}

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

// Data fetching components
async function DashboardStats() {
  const stats = await dashboardService.getDashboardStats()
  return <StatsCards stats={stats} />
}

async function DashboardActivity() {
  const activities = await dashboardService.getRecentActivity()
  return <RecentActivityCard activities={activities} />
}

async function DashboardActions() {
  const stats = await dashboardService.getDashboardStats()
  const actions = dashboardService.getQuickActions(stats)
  return <QuickActionsCard actions={actions} />
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your admin dashboard overview.
        </p>
      </div>

      <Suspense fallback={<StatsLoading />}>
        <DashboardStats />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Suspense fallback={<ActivityLoading />}>
          <DashboardActivity />
        </Suspense>

        <Suspense fallback={<ActionsLoading />}>
          <DashboardActions />
        </Suspense>
      </div>
    </div>
  )
}