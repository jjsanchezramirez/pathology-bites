// src/shared/services/notification-generators.ts
// Generator functions for creating user notifications

import { createClient } from "@/shared/services/server";

export const notificationGenerators = {
  async createPerfectScoreNotification(
    _userId: string,
    _quizType: string,
    _totalQuestions: number
  ): Promise<void> {
    const _supabase = await createClient();
    // Implementation would create a notification in the database
    console.log("Creating perfect score notification for user:", _userId);
  },

  async createInquiryNotification(_inquiryId: string): Promise<void> {
    const _supabase = await createClient();
    console.log("Creating inquiry notification for inquiry:", _inquiryId);
  },

  async checkQuestionsAnsweredMilestone(
    _userId: string,
    _totalQuestionsAnswered: number
  ): Promise<void> {
    console.log("Checking questions answered milestone for user:", _userId);
  },

  async checkQuizStreakMilestone(_userId: string, _currentStreak: number): Promise<void> {
    console.log("Checking quiz streak milestone for user:", _userId);
  },

  async checkCategoryMasteryMilestone(
    _userId: string,
    _category: string,
    _accuracy: number
  ): Promise<void> {
    console.log("Checking category mastery milestone for user:", _userId);
  },

  async checkLoginStreakMilestone(_userId: string, _loginStreak: number): Promise<void> {
    console.log("Checking login streak milestone for user:", _userId);
  },

  async createAchievementNotification(
    _userId: string,
    _achievementType: string,
    _title: string,
    _message: string,
    _metadata: Record<string, unknown>
  ): Promise<void> {
    const _supabase = await createClient();
    console.log("Creating achievement notification for user:", _userId);
  },

  async checkStudyTimeMilestone(_userId: string, _totalHours: number): Promise<void> {
    console.log("Checking study time milestone for user:", _userId);
  },

  async createReminderNotification(
    _userId: string,
    _reminderType: string,
    _title: string,
    _message: string
  ): Promise<void> {
    const _supabase = await createClient();
    console.log("Creating reminder notification for user:", _userId);
  },

  async broadcastSystemUpdate(
    title: string,
    message: string,
    updateType: string,
    severity: string,
    targetAudience: string
  ): Promise<void> {
    const supabase = await createClient();

    try {
      // Get the current authenticated user (admin who is creating the notification)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Create the system update record
      const { data: systemUpdate, error: systemUpdateError } = await supabase
        .from("system_updates")
        .insert({
          title,
          message,
          update_type: updateType,
          severity,
          target_audience: targetAudience,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (systemUpdateError) {
        console.error("Error creating system update:", systemUpdateError);
        throw new Error(`Failed to create system update: ${systemUpdateError.message}`);
      }

      console.log("System update created:", systemUpdate.id);

      // Get target users based on audience
      let targetUserIds: string[] = [];

      if (targetAudience === "all") {
        // Get all users
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id")
          .eq("status", "active");

        if (usersError) {
          console.error("Error fetching users:", usersError);
          throw new Error(`Failed to fetch users: ${usersError.message}`);
        }

        targetUserIds = users?.map((u) => u.id) || [];
      } else {
        // Get users with specific role
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id")
          .eq("role", targetAudience)
          .eq("status", "active");

        if (usersError) {
          console.error("Error fetching users by role:", usersError);
          throw new Error(`Failed to fetch users by role: ${usersError.message}`);
        }

        targetUserIds = users?.map((u) => u.id) || [];
      }

      // Create notification_states for each target user
      if (targetUserIds.length > 0) {
        const notificationStates = targetUserIds.map((userId) => ({
          user_id: userId,
          source_type: "system_update",
          source_id: systemUpdate.id,
          read: false,
        }));

        const { error: notificationError } = await supabase
          .from("notification_states")
          .insert(notificationStates);

        if (notificationError) {
          console.error("Error creating notification states:", notificationError);
          throw new Error(`Failed to create notification states: ${notificationError.message}`);
        }

        console.log(`Broadcast complete: ${targetUserIds.length} users notified`);
      } else {
        console.warn("No target users found for notification");
      }
    } catch (error) {
      console.error("Error in broadcastSystemUpdate:", error);
      throw error;
    }
  },
};
