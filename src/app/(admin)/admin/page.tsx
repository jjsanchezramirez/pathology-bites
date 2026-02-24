// src/app/(admin)/admin/page.tsx
"use client";

import { useUserRole } from "@/shared/hooks/use-user-role";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context";
import { useDashboardData } from "@/features/admin/dashboard/hooks/use-dashboard-data";
import { clientDashboardService } from "@/features/admin/dashboard/services/client-service";
import { StatsCards } from "@/features/admin/dashboard/components/stats-cards";
import { RecentActivityCard } from "@/features/admin/dashboard/components/recent-activity";
import { QuickActionsCard } from "@/features/admin/dashboard/components/quick-actions";
import { SystemStatus } from "@/features/admin/dashboard/components/system-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { UserRole } from "@/shared/utils/auth/auth-helpers";

export default function AdminDashboardPage() {
  // Get user data from auth context
  const { user } = useAuthContext();

  // Get role information
  const { role, isLoading: roleLoading } = useUserRole();

  // Get theme and admin mode
  const { adminMode, isTransitioning } = useDashboardTheme();

  // Fetch dashboard data using simplified hook
  // This hook handles all complexity:
  // - Waits for role to load before fetching
  // - Handles caching and revalidation via SWR
  // - Eliminates race conditions through proper enabled flags
  // - Provides proper error handling
  // - No manual useEffect needed
  const { stats, activities, isLoading: dataLoading, error } = useDashboardData(
    role,
    user?.id,
    roleLoading
  );

  // Compute effective role for UI (quick actions only)
  // This is NOT used for data fetching (eliminates stale closure issues)
  const effectiveRole = adminMode === "user" ? "user" : adminMode;

  // Get quick actions based on stats and effective role
  const quickActions = stats ? clientDashboardService.getQuickActions(stats, effectiveRole as UserRole) : [];

  // Single loading state: transitioning OR data loading
  const isLoading = isTransitioning || dataLoading;

  return (
    <div className="space-y-6">
      {/* Hide content completely when transitioning to avoid title flickering */}
      {isTransitioning ? (
        <>
          {/* Title skeleton */}
          <div className="space-y-2">
            <div className="h-9 bg-muted animate-pulse rounded w-64"></div>
            <div className="h-5 bg-muted animate-pulse rounded w-96"></div>
          </div>

          {/* Stats skeleton */}
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
        </>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" suppressHydrationWarning>
              {adminMode === "creator"
                ? "Creator Dashboard"
                : adminMode === "reviewer"
                  ? "Reviewer Dashboard"
                  : adminMode === "user"
                    ? "Student Dashboard"
                    : "Admin Dashboard"}
            </h1>
            <p className="text-muted-foreground" suppressHydrationWarning>
              {adminMode === "creator"
                ? "Question creation and content management."
                : adminMode === "reviewer"
                  ? "Review queue and question approval."
                  : adminMode === "user"
                    ? "Learning progress and quiz performance."
                    : "Administrative overview and system management."}
            </p>
          </div>

          {error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">
                    Error Loading Dashboard
                  </h3>
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.location.reload();
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
              {adminMode === "admin" && <SystemStatus />}
            </>
          )}
        </>
      )}
    </div>
  );
}
