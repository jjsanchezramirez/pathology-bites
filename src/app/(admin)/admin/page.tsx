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

export default function AdminDashboardPage() {
  // Get user data from auth context
  const { user } = useAuthContext();

  // Get role information
  const { role, permissions, isAdmin, can, isLoading: roleLoading } = useUserRole();

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
  } = useDashboardData(role, permissions, user?.id, roleLoading);

  // Quick actions follow what the user may do (admin, or their permissions)
  const quickActions = stats
    ? clientDashboardService.getQuickActions(stats, role, permissions)
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

  const writes = can("create_questions");
  const reviews = can("review_questions");
  const title = isAdmin ? "Admin Dashboard" : "Contributor Dashboard";
  const description = isAdmin
    ? "Administrative overview and system management."
    : writes && reviews
      ? "Your questions and your review queue."
      : reviews
        ? "Review queue and question approval."
        : "Question creation and content management.";

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
        </>
      )}
      {/* System Status - admins only: /api/admin/system-status returns active-user and
          storage figures and 403s everyone else (contributors share admin mode).
          Outside the loading switch on purpose: it has its own skeleton, and mounting it
          only after the stats arrived made its request wait for theirs. */}
      {adminMode === "admin" && isAdmin && <SystemStatus />}
    </PageContainer>
  );
}
