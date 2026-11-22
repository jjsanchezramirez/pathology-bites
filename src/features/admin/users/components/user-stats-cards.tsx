"use client";

// User statistics cards for user management dashboard
import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  SectionCard,
  StatCard,
  StatCardSkeleton,
  StatGrid,
} from "@/shared/components/ui/page-layout";
import { Users, UserCheck, UserX, UserMinus, UserCog } from "lucide-react";
import { toast } from "@/shared/utils/ui/toast";
import {
  getFormattedUserStats,
  UserStatsFormatted,
} from "@/features/admin/users/services/user-stats";
import { unifiedCache, CACHE_NAMESPACES } from "@/shared/services/unified-cache";
import { log } from "@/shared/utils/logging";

export interface UserStatsRef {
  refresh: () => void;
}

const CACHE_KEY = "user-stats";

export const UserStatsCards = forwardRef<UserStatsRef>((_props, ref) => {
  const [stats, setStats] = useState<UserStatsFormatted | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async (forceRefresh = false) => {
    try {
      setLoading(true);

      // Check unified cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cached = unifiedCache.get<UserStatsFormatted>(CACHE_NAMESPACES.SWR.name, CACHE_KEY, {
          ttl: 30 * 60 * 1000, // 30 minutes
        });

        if (cached) {
          setStats(cached);
          setLoading(false);
          return;
        }
      }

      // Fetch fresh data using optimized database function
      const data = await getFormattedUserStats();
      setStats(data);

      // Cache the result in unified cache
      unifiedCache.set(CACHE_NAMESPACES.SWR.name, CACHE_KEY, data, {
        ttl: 30 * 60 * 1000, // 30 minutes
      });
    } catch (error) {
      log.error("Failed to load user stats:", error);
      toast.error("Failed to load user statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Expose refresh function via ref
  useImperativeHandle(ref, () => ({
    refresh: () => loadStats(true),
  }));

  if (loading) {
    return (
      <StatGrid columns={3}>
        {[1, 2, 3, 4, 5].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </StatGrid>
    );
  }

  if (!stats) {
    return (
      <SectionCard>
        <p className="text-sm text-muted-foreground">Failed to load user statistics</p>
      </SectionCard>
    );
  }

  return (
    <StatGrid columns={3}>
      <StatCard
        label={stats.totalUsers.label}
        value={stats.totalUsers.count}
        icon={Users}
        hint={
          <>
            Internal Users: {stats.totalUsers.breakdown.internal}, End Users:{" "}
            {stats.totalUsers.breakdown.endUsers}
          </>
        }
      />
      <StatCard
        label={stats.internalUsers.label}
        value={stats.internalUsers.count}
        icon={UserCog}
        hint={
          <>
            Admin: {stats.internalUsers.breakdown.admins}, Creator:{" "}
            {stats.internalUsers.breakdown.creators}, Reviewer:{" "}
            {stats.internalUsers.breakdown.reviewers}
          </>
        }
      />
      <StatCard
        label={stats.activeUsers.label}
        value={stats.activeUsers.count}
        icon={UserCheck}
        tone="success"
        hint={stats.activeUsers.description}
      />
      <StatCard
        label={stats.inactiveUsers.label}
        value={stats.inactiveUsers.count}
        icon={UserMinus}
        hint={`${stats.inactiveUsers.description} (${stats.inactiveUsers.percentage})`}
      />
      <StatCard
        label={stats.suspendedUsers.label}
        value={stats.suspendedUsers.count}
        icon={UserX}
        tone="danger"
        hint={`${stats.suspendedUsers.description} (${stats.suspendedUsers.percentage})`}
      />
    </StatGrid>
  );
});

UserStatsCards.displayName = "UserStatsCards";
