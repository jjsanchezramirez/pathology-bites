'use client'

// User statistics cards for user management dashboard
import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Loader2,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  UserCog,

} from 'lucide-react';
import { toast } from 'sonner';
import { getFormattedUserStats, UserStatsFormatted } from '@/features/users/services/user-stats';

export interface UserStatsRef {
  refresh: () => void;
}

export const UserStatsCards = forwardRef<UserStatsRef>((props, ref) => {
  const [stats, setStats] = useState<UserStatsFormatted | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getFormattedUserStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load user stats:', error);
      toast.error('Failed to load user statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Expose refresh function via ref
  useImperativeHandle(ref, () => ({
    refresh: loadStats
  }));

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Loading data...</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Failed to load user statistics</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Users Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{stats.totalUsers.label}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalUsers.count}</div>
          <div className="text-xs text-muted-foreground">
            Internal Users: {stats.totalUsers.breakdown.internal}, End Users: {stats.totalUsers.breakdown.endUsers}
          </div>
        </CardContent>
      </Card>

      {/* Internal Users Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{stats.internalUsers.label}</CardTitle>
          <UserCog className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.internalUsers.count}</div>
          <div className="text-xs text-muted-foreground">
            Admin: {stats.internalUsers.breakdown.admins}, Creator: {stats.internalUsers.breakdown.creators}, Reviewer: {stats.internalUsers.breakdown.reviewers}
          </div>
        </CardContent>
      </Card>

      {/* Active Users Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{stats.activeUsers.label}</CardTitle>
          <UserCheck className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.activeUsers.count}</div>
          <p className="text-xs text-muted-foreground">
            {stats.activeUsers.description}
          </p>
        </CardContent>
      </Card>

      {/* Inactive Users Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{stats.inactiveUsers.label}</CardTitle>
          <UserMinus className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-500">{stats.inactiveUsers.count}</div>
          <p className="text-xs text-muted-foreground">
            {stats.inactiveUsers.description} ({stats.inactiveUsers.percentage})
          </p>
        </CardContent>
      </Card>

      {/* Suspended Users Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{stats.suspendedUsers.label}</CardTitle>
          <UserX className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.suspendedUsers.count}</div>
          <p className="text-xs text-muted-foreground">
            {stats.suspendedUsers.description} ({stats.suspendedUsers.percentage})
          </p>
        </CardContent>
      </Card>
    </div>
  );
});

UserStatsCards.displayName = 'UserStatsCards';
