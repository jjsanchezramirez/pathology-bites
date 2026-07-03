// src/lib/notifications/service.ts
import { createClient } from "@/shared/services/client";

import {
  NotificationWithSource,
  PaginatedNotifications,
  NotificationSourceType,
  SystemUpdatePayload as _SystemUpdatePayload,
  MilestonePayload as _MilestonePayload,
  ReminderPayload as _ReminderPayload,
} from "@/shared/types/notifications";
import { InquiryData } from "@/features/admin/inquiries/types/inquiries";

export class NotificationsService {
  private getSupabase() {
    return createClient();
  }

  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedNotifications> {
    try {
      // Calculate offset
      const offset = (page - 1) * limit;

      // Get total count first
      const { count: totalCount, error: countError } = await this.getSupabase()
        .from("notification_states")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countError) {
        throw countError;
      }

      // Build the query for notification_states with pagination
      const { data: notificationStates, error } = await this.getSupabase()
        .from("notification_states")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      if (!notificationStates || notificationStates.length === 0) {
        return {
          notifications: [],
          total: totalCount || 0,
          page,
          limit,
          hasMore: false,
        };
      }

      // Group source IDs by type for efficient fetching
      const sourceIdsByType = notificationStates.reduce(
        (acc, state) => {
          if (!acc[state.source_type]) {
            acc[state.source_type] = [];
          }
          acc[state.source_type].push(state.source_id);
          return acc;
        },
        {} as Record<string, string[]>
      );

      // Fetch source data for existing tables only
      const [inquiries, systemUpdates] = await Promise.all([
        sourceIdsByType.inquiry?.length > 0 ? this.getInquiries(sourceIdsByType.inquiry) : [],
        sourceIdsByType.system_update?.length > 0
          ? this.getSystemUpdates(sourceIdsByType.system_update)
          : [],
      ]);

      // Create lookup maps for existing source types
      const inquiryMap = new Map(inquiries.map((i) => [i.id, i] as const));
      const systemUpdateMap = new Map(systemUpdates.map((s) => [s.id, s] as const));

      // Combine notification states with source data
      const notifications: NotificationWithSource[] = notificationStates
        .map((row): NotificationWithSource | null => {
          // source_type is plain text in the DB; the app narrows it
          const state = { ...row, source_type: row.source_type as NotificationSourceType };
          if (state.source_type === "inquiry") {
            const inquiry = inquiryMap.get(state.source_id);
            if (!inquiry) return null;

            return {
              ...state,
              title: `${inquiry.request_type === "general" ? "General" : "Technical"} Inquiry`,
              description: `${inquiry.first_name} ${inquiry.last_name} submitted an inquiry`,
              status: "pending",
              metadata: {
                email: inquiry.email,
                organization: inquiry.organization,
                request_type: inquiry.request_type,
                inquiry_text: inquiry.inquiry,
              },
            };
          }

          // Handle direct notification types (no separate source table needed)
          else if (state.source_type === "admin_alert") {
            return {
              ...state,
              title: "Admin Alert",
              description: "New admin activity requires attention",
              status: "pending",
              metadata: {},
            };
          } else if (state.source_type === "question_review") {
            return {
              ...state,
              title: "Question Review Required",
              description: "A question needs your review",
              status: "pending",
              metadata: {},
            };
          } else if (state.source_type === "question_status") {
            return {
              ...state,
              title: "Question Status Update",
              description: "Your question status has changed",
              status: "updated",
              metadata: {},
            };
          } else if (state.source_type === "system_update") {
            const systemUpdate = systemUpdateMap.get(state.source_id);
            if (!systemUpdate) return null;

            return {
              ...state,
              title: systemUpdate.title,
              description: systemUpdate.message,
              status: systemUpdate.severity,
              metadata: {
                update_type: systemUpdate.update_type,
                severity: systemUpdate.severity,
                target_audience: systemUpdate.target_audience,
                published_at: systemUpdate.published_at,
              },
            };
          }

          return null;
        })
        .filter((n): n is NotificationWithSource => n !== null);

      const hasMore = (totalCount || 0) > page * limit;

      return {
        notifications,
        total: totalCount || 0,
        page,
        limit,
        hasMore,
      };
    } catch (error) {
      throw error;
    }
  }

  private async getInquiries(ids: string[]): Promise<InquiryData[]> {
    if (ids.length === 0) return [];

    const { data, error } = await this.getSupabase().from("inquiries").select("*").in("id", ids);

    if (error) {
      throw error;
    }

    return data || [];
  }

  private async getSystemUpdates(ids: string[]): Promise<
    Array<{
      id: string;
      title: string;
      message: string;
      update_type: string;
      severity: string;
      target_audience: string;
      published_at: string;
    }>
  > {
    if (ids.length === 0) return [];

    const { data, error } = await this.getSupabase()
      .from("system_updates")
      .select("id, title, message, update_type, severity, target_audience, published_at")
      .in("id", ids);

    if (error) {
      throw error;
    }

    return data || [];
  }

  // Simple notification creation for admin dashboard events
  async createAdminNotification(
    userId: string,
    sourceType: "admin_alert" | "question_review" | "question_status",
    sourceId: string
  ): Promise<void> {
    const { error } = await this.getSupabase().from("notification_states").insert({
      user_id: userId,
      source_type: sourceType,
      source_id: sourceId,
      read: false,
    });

    if (error) {
      throw error;
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await this.getSupabase()
      .from("notification_states")
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) {
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await this.getSupabase()
      .from("notification_states")
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.getSupabase()
      .from("notification_states")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      throw error;
    }

    return count || 0;
  }
}

export const notificationsService = new NotificationsService();
