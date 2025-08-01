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
    // Use the standardized view with v_ prefix
    const { data, error } = await supabase
      .from('v_user_stats')
      .select('*')
      .single();

    if (error) throw error;

    return {
      total_users: data.total_users,
      active_users: data.active_users,
      inactive_users: data.inactive_users,
      suspended_users: data.suspended_users,
      recent_users: data.recent_users,
      internal_users: data.internal_users,
      end_users: data.end_users,
      active_internal_users: data.active_internal_users,
      active_end_users: data.active_end_users,
      total_admins: data.total_admins,
      total_creators: data.total_creators,
      total_reviewers: data.total_reviewers,
      active_admins: data.active_admins,
      active_creators: data.active_creators,
      active_reviewers: data.active_reviewers,
      active_percentage: data.active_percentage,
      inactive_percentage: data.inactive_percentage,
      suspended_percentage: data.suspended_percentage,
      internal_percentage: data.internal_percentage,
      end_users_percentage: data.end_users_percentage,
      last_updated: data.last_updated
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
