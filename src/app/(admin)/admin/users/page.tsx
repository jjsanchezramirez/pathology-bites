// src/app/(admin)/admin/users/page.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { UserStatsCards, UserStatsRef } from "@/features/admin/users/components/user-stats-cards";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard, StatCard } from "@/shared/components/ui/page-layout";
import { UsersManagementTabs } from "@/features/admin/users/components/users-management-tabs";
import { Loader2, UserPlus } from "lucide-react";
import { log } from "@/shared/utils/logging";

export default function UsersPage() {
  const userStatsRef = useRef<UserStatsRef>(null);
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [loadingWaitlistCount, setLoadingWaitlistCount] = useState(true);

  const handleUserChange = () => {
    // Refresh user stats when user data changes
    userStatsRef.current?.refresh();
  };

  const fetchWaitlistCount = async () => {
    setLoadingWaitlistCount(true);
    try {
      const response = await fetch("/api/admin/waitlist?page=1&limit=1");
      if (!response.ok) throw new Error("Failed to fetch waitlist count");

      const result = await response.json();
      setWaitlistCount(result.pagination?.total || 0);
    } catch (error) {
      log.error("Error fetching waitlist count:", error);
      setWaitlistCount(0);
    } finally {
      setLoadingWaitlistCount(false);
    }
  };

  useEffect(() => {
    fetchWaitlistCount();
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="User Management"
        description="Manage users, roles, permissions, and waitlist"
      />

      {/* User Statistics Cards (waitlist count shares the grid) */}
      <UserStatsCards ref={userStatsRef}>
        <StatCard
          label="Waitlist"
          icon={UserPlus}
          value={
            loadingWaitlistCount ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              waitlistCount
            )
          }
          hint={`${waitlistCount === 1 ? "User" : "Users"} waiting for platform access`}
        />
      </UserStatsCards>

      {/* Main Management Card with Tabs */}
      <SectionCard
        title="User Management Tools"
        description="Manage registered users and view waitlist submissions in a unified interface"
      >
        <UsersManagementTabs onUserChange={handleUserChange} />
      </SectionCard>
    </PageContainer>
  );
}
