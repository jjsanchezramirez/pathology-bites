// User statistics service
import { createClient } from '@/shared/services/client';

export interface UserStats {
  // Overall user counts
  total_users: number;
  active_users: number;
  inactive_users: number;
  suspended_users: number;
  recent_users: number;

  // Internal vs End users breakdown
  internal_users: number;
  end_users: number;
  active_internal_users: number;
  active_end_users: number;

  // Role breakdown for internal users
  total_admins: number;
  total_creators: number;
  total_reviewers: number;
  active_admins: number;
  active_creators: number;
  active_reviewers: number;

  // Calculated percentages
  active_percentage: string;
  inactive_percentage: string;
  suspended_percentage: string;
  internal_percentage: string;
  end_users_percentage: string;

  // Metadata
  last_updated: string;
}

export interface UserStatsFormatted {
  // Main statistics cards
  totalUsers: {
    count: number;
    label: string;
    description: string;
    breakdown: {
      internal: number;
      endUsers: number;
    };
  };
  internalUsers: {
    count: number;
    label: string;
    description: string;
    breakdown: {
      admins: number;
      creators: number;
      reviewers: number;
    };
  };
  activeUsers: {
    count: number;
    label: string;
    description: string;
    percentage: string;
  };
  inactiveUsers: {
    count: number;
    label: string;
    description: string;
    percentage: string;
  };
  suspendedUsers: {
    count: number;
    label: string;
    description: string;
    percentage: string;
  };

  // Additional metadata
  recentUsers: number;
  lastUpdated: string;
}

export async function getUserStats(): Promise<UserStats> {
  const supabase = createClient();

  try {
    // Use optimized database function for minimal data transfer
    const { data, error } = await supabase
      .rpc('get_user_statistics');

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No user statistics found');

    const stats = data[0];

    return {
      total_users: stats.total_users,
      active_users: stats.active_users,
      inactive_users: stats.inactive_users,
      suspended_users: stats.suspended_users,
      recent_users: stats.recent_users,
      internal_users: stats.internal_users,
      end_users: stats.end_users,
      active_internal_users: stats.active_internal_users,
      active_end_users: stats.active_end_users,
      total_admins: stats.total_admins,
      total_creators: stats.total_creators,
      total_reviewers: stats.total_reviewers,
      active_admins: stats.active_admins,
      active_creators: stats.active_creators,
      active_reviewers: stats.active_reviewers,
      active_percentage: stats.active_percentage,
      inactive_percentage: stats.inactive_percentage,
      suspended_percentage: stats.suspended_percentage,
      internal_percentage: stats.internal_percentage,
      end_users_percentage: stats.end_users_percentage,
      last_updated: stats.last_updated
    };
  } catch (error) {
    console.error('Get user stats error:', error);
    throw error;
  }
}

export async function getFormattedUserStats(): Promise<UserStatsFormatted> {
  const stats = await getUserStats();

  return {
    totalUsers: {
      count: stats.total_users,
      label: 'Total Users',
      description: '',
      breakdown: {
        internal: stats.internal_users,
        endUsers: stats.end_users
      }
    },
    internalUsers: {
      count: stats.internal_users,
      label: 'Internal Users',
      description: '',
      breakdown: {
        admins: stats.total_admins,
        creators: stats.total_creators,
        reviewers: stats.total_reviewers
      }
    },
    activeUsers: {
      count: stats.active_users,
      label: 'Active End Users',
      description: `${stats.recent_users} joined in last 30 days`,
      percentage: `${stats.active_percentage}%`
    },
    inactiveUsers: {
      count: stats.inactive_users,
      label: 'Inactive End Users',
      description: 'Inactive accounts',
      percentage: `${stats.inactive_percentage}%`
    },
    suspendedUsers: {
      count: stats.suspended_users,
      label: 'Suspended Users',
      description: 'Suspended accounts',
      percentage: `${stats.suspended_percentage}%`
    },
    recentUsers: stats.recent_users,
    lastUpdated: stats.last_updated
  };
}

// Helper function to get role distribution
export async function getRoleDistribution(): Promise<{
  role: string;
  count: number;
  percentage: string;
}[]> {
  const stats = await getUserStats();

  const roles = [
    { role: 'admin', count: stats.total_admins },
    { role: 'creator', count: stats.total_creators },
    { role: 'reviewer', count: stats.total_reviewers },
    { role: 'user', count: stats.end_users }
  ];

  return roles.map(role => ({
    ...role,
    percentage: stats.total_users > 0
      ? `${Math.round((role.count / stats.total_users) * 100)}%`
      : '0%'
  }));
}

// Helper function to get status distribution
export async function getStatusDistribution(): Promise<{
  status: string;
  count: number;
  percentage: string;
}[]> {
  const stats = await getUserStats();
  
  const statuses = [
    { status: 'active', count: stats.active_users },
    { status: 'inactive', count: stats.inactive_users },
    { status: 'suspended', count: stats.suspended_users }
  ];

  return statuses.map(status => ({
    ...status,
    percentage: stats.total_users > 0 
      ? `${Math.round((status.count / stats.total_users) * 100)}%`
      : '0%'
  }));
}
