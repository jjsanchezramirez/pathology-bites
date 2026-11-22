// src/app/(admin)/admin/users/page.tsx
"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { UserStatsCards, UserStatsRef } from "@/features/admin/users/components/user-stats-cards";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";
import { Skeleton } from "@/shared/components/ui/skeleton";

// Client-only: UsersTable reads the SWR cache, which is persisted to localStorage, so its
// first client render (cached rows) can never match a server render (loading state).
const UsersTable = dynamic(
  () => import("@/features/admin/users/components/users-table").then((m) => m.UsersTable),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
);

export default function UsersPage() {
  const userStatsRef = useRef<UserStatsRef>(null);

  // Refresh user stats when user data changes
  const handleUserChange = () => {
    userStatsRef.current?.refresh();
  };

  return (
    <PageContainer>
      <PageHeader title="User Management" description="Manage users, roles and permissions" />

      <UserStatsCards ref={userStatsRef} />

      <SectionCard title="Registered Users" description="Search, edit and manage user accounts">
        <UsersTable onUserChange={handleUserChange} />
      </SectionCard>
    </PageContainer>
  );
}
