// src/app/(admin)/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context";
import { useDashboardData } from "@/features/admin/dashboard/hooks/use-dashboard-data";
import { clientDashboardService } from "@/features/admin/dashboard/services/client-service";
import { StatsCards } from "@/features/admin/dashboard/components/stats-cards";
import { RecentActivityCard } from "@/features/admin/dashboard/components/recent-activity";
import { QuickActionsCard } from "@/features/admin/dashboard/components/quick-actions";
import { SystemStatus } from "@/features/admin/dashboard/components/system-status";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { PageHeader } from "@/shared/components/ui/page-header";
import {
  ContentGrid,
  PageContainer,
  SectionCard,
  StatCardSkeleton,
  StatGrid,
} from "@/shared/components/ui/page-layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { UserRole } from "@/shared/utils/auth/auth-helpers";

export default function AdminDashboardPage() {
  // Get user data from auth context
  const { user } = useAuthContext();

  // Get role information
  const { role, isLoading: roleLoading } = useUserRole();

  // Get theme and admin mode
  const { adminMode, isTransitioning, setTransitioning } = useDashboardTheme();

  // Fetch dashboard data using simplified hook
  // This hook handles all complexity:
  // - Waits for role to load before fetching
  // - Handles caching and revalidation via SWR
  // - Eliminates race conditions through proper enabled flags
  // - Provides proper error handling
  // - No manual useEffect needed
  const {
    stats,
    activities,
    isLoading: dataLoading,
    error,
  } = useDashboardData(role, user?.id, roleLoading);

  // Compute effective role for UI (quick actions only)
  // This is NOT used for data fetching (eliminates stale closure issues)
  const effectiveRole = adminMode === "user" ? "user" : adminMode;

  // Get quick actions based on stats and effective role
  const quickActions = stats
    ? clientDashboardService.getQuickActions(stats, effectiveRole as UserRole)
    : [];

  // Single loading state: transitioning OR data loading OR data not ready OR adminMode is "user"
  // Note: adminMode === "user" on the admin page means we're transitioning to student mode
  const isLoading = isTransitioning || dataLoading || !stats || !activities || adminMode === "user";

  // Clear transition flag when data is ready
  useEffect(() => {
    if (!dataLoading && stats && activities && isTransitioning) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setTransitioning(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dataLoading, stats, activities, isTransitioning, setTransitioning]);

  // Defer client-only branching (cookie reads, role detection) until after hydration commit.
  // Why: getAdminModeFromCookie reads document.cookie on the client but falls back to a role-derived
  // default on the server. The two paths can disagree on the first render, producing a hydration mismatch
  // when the SSR skeleton's parent structure differs from the populated client tree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const title =
    adminMode === "creator"
      ? "Creator Dashboard"
      : adminMode === "reviewer"
        ? "Reviewer Dashboard"
        : "Admin Dashboard";
  const description =
    adminMode === "creator"
      ? "Question creation and content management."
      : adminMode === "reviewer"
        ? "Review queue and question approval."
        : "Administrative overview and system management.";

  const statsSkeleton = (
    <StatGrid>
      {Array.from({ length: 8 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </StatGrid>
  );

  // Hide content when transitioning OR when adminMode is "user" to prevent showing student content on admin page
  if (!mounted || isTransitioning || adminMode === "user") {
    return (
      <PageContainer>
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 sm:h-9" />
          <Skeleton className="h-5 w-full max-w-96" />
        </div>
        {statsSkeleton}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={title} description={description} />

      {error ? (
        <SectionCard className="border-destructive/30">
          <EmptyState
            icon={AlertTriangle}
            title="Error loading dashboard"
            description={error}
            action={
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            }
          />
        </SectionCard>
      ) : isLoading ? (
        <>
          {statsSkeleton}
          <ContentGrid>
            {["Recent Activity", "Quick Actions"].map((t) => (
              <SectionCard key={t} title={t}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="mt-1 h-4 w-4" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48 max-w-full" />
                      <Skeleton className="h-3 w-64 max-w-full" />
                    </div>
                  </div>
                ))}
              </SectionCard>
            ))}
          </ContentGrid>
        </>
      ) : (
        <>
          <StatsCards stats={stats} />
          <ContentGrid>
            <RecentActivityCard activities={activities} />
            <QuickActionsCard actions={quickActions} />
          </ContentGrid>
          {/* System Status - Only show for admin mode */}
          {adminMode === "admin" && <SystemStatus />}
        </>
      )}
    </PageContainer>
  );
}
