// src/app/(admin)/admin/users/page.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { UserStatsCards, UserStatsRef } from "@/features/admin/users/components/user-stats-cards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { UsersManagementTabs } from "@/features/admin/users/components/users-management-tabs";
import { Loader2 } from "lucide-react";

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
      console.error("Error fetching waitlist count:", error);
      setWaitlistCount(0);
    } finally {
      setLoadingWaitlistCount(false);
    }
  };

  useEffect(() => {
    fetchWaitlistCount();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage users, roles, permissions, and waitlist</p>
      </div>

      {/* User Statistics Cards */}
      <UserStatsCards ref={userStatsRef} />

      {/* Waitlist Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Waitlist Summary</CardTitle>
          <CardDescription>Users waiting for platform access</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingWaitlistCount ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading waitlist count...</span>
            </div>
          ) : (
            <div className="text-3xl font-bold">{waitlistCount}</div>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {waitlistCount === 1 ? "user" : "users"} on waitlist
          </p>
        </CardContent>
      </Card>

      {/* Main Management Card with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>User Management Tools</CardTitle>
          <CardDescription>
            Manage registered users and view waitlist submissions in a unified interface
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersManagementTabs onUserChange={handleUserChange} />
        </CardContent>
      </Card>
    </div>
  );
}
