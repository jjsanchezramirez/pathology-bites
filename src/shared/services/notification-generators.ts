// src/shared/services/notification-generators.ts
// Generator functions for creating user notifications

import { createClient } from "@/shared/services/server";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";

const PAGE = 1000;

/**
 * Announcement audiences other than "all", as PostgREST filters on public.users.
 * Staff = admins plus anyone holding a permission; user = everyone else.
 */
const AUDIENCE_FILTERS = {
  user: "and(role.eq.user,permissions.eq.{})",
  staff: "role.eq.admin,permissions.neq.{}",
} as const;

export const notificationGenerators = {
  async createPerfectScoreNotification(
    _userId: string,
    _quizType: string,
    _totalQuestions: number
  ): Promise<void> {
    const _supabase = await createClient();
    // Implementation would create a notification in the database
    log.debug("Creating perfect score notification for user:", _userId);
  },

  async createInquiryNotification(_inquiryId: string): Promise<void> {
    const _supabase = await createClient();
    log.debug("Creating inquiry notification for inquiry:", _inquiryId);
  },

  async checkQuestionsAnsweredMilestone(
    _userId: string,
    _totalQuestionsAnswered: number
  ): Promise<void> {
    log.debug("Checking questions answered milestone for user:", _userId);
  },

  async checkQuizStreakMilestone(_userId: string, _currentStreak: number): Promise<void> {
    log.debug("Checking quiz streak milestone for user:", _userId);
  },

  async checkCategoryMasteryMilestone(
    _userId: string,
    _category: string,
    _accuracy: number
  ): Promise<void> {
    log.debug("Checking category mastery milestone for user:", _userId);
  },

  async checkLoginStreakMilestone(_userId: string, _loginStreak: number): Promise<void> {
    log.debug("Checking login streak milestone for user:", _userId);
  },

  async createAchievementNotification(
    _userId: string,
    _achievementType: string,
    _title: string,
    _message: string,
    _metadata: Record<string, unknown>
  ): Promise<void> {
    const _supabase = await createClient();
    log.debug("Creating achievement notification for user:", _userId);
  },

  /**
   * Notify a user about a question in the review workflow: "question_review" tells a
   * reviewer a question is waiting for them, "question_status" tells the author it was
   * approved or rejected. The row only points at the question (source_id); the text is
   * built from the question when notifications are listed.
   *
   * Service-role client: notification_states RLS only lets a user insert rows for
   * themselves, and these go to someone else. The table allows one row per
   * (user, type, question), so a repeat event (rejected, then approved) replaces the
   * old row, which brings it back to the top as unread.
   */
  async createQuestionNotification(
    userId: string,
    sourceType: "question_review" | "question_status",
    questionId: string
  ): Promise<void> {
    const admin = createServiceRoleClient();
    const { error: clearError } = await admin
      .from("notification_states")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("source_id", questionId);
    if (clearError) throw new Error(`Failed to replace notification: ${clearError.message}`);

    const { error } = await admin.from("notification_states").insert({
      user_id: userId,
      source_type: sourceType,
      source_id: questionId,
      read: false,
    });
    if (error) throw new Error(`Failed to create notification: ${error.message}`);
  },

  async checkStudyTimeMilestone(_userId: string, _totalHours: number): Promise<void> {
    log.debug("Checking study time milestone for user:", _userId);
  },

  async createReminderNotification(
    _userId: string,
    _reminderType: string,
    _title: string,
    _message: string
  ): Promise<void> {
    const _supabase = await createClient();
    log.debug("Creating reminder notification for user:", _userId);
  },

  /**
   * Saves an announcement and creates one notification per recipient.
   *
   * Server-only, and only after the caller has been checked as an admin: the writes go through
   * the service-role client because notification_states RLS lets a user insert rows only for
   * themselves, so the admin's own client can never notify anyone else.
   */
  async broadcastSystemUpdate(
    title: string,
    message: string,
    updateType: string,
    severity: string,
    targetAudience: string
  ): Promise<void> {
    // "all" = every active account; otherwise the roles behind the audience.
    const audienceFilter =
      targetAudience === "all"
        ? null
        : AUDIENCE_FILTERS[targetAudience as keyof typeof AUDIENCE_FILTERS];
    if (audienceFilter === undefined) throw new Error(`Unknown target audience: ${targetAudience}`);

    // The admin's own session, only to record who sent it.
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    const admin = createServiceRoleClient();

    // Recipients first, so a failure here leaves nothing behind. Paged in id order: a single
    // select is capped at 1,000 rows, and unordered pages can skip rows.
    const targetUserIds: string[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = admin.from("users").select("id").eq("status", "active");
      if (audienceFilter) query = query.or(audienceFilter);
      const { data, error } = await query.order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(`Failed to fetch users: ${error.message}`);
      targetUserIds.push(...data.map((u) => u.id));
      if (data.length < PAGE) break;
    }

    const { data: systemUpdate, error: systemUpdateError } = await admin
      .from("system_updates")
      .insert({
        title,
        message,
        update_type: updateType,
        severity,
        target_audience: targetAudience,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (systemUpdateError) {
      throw new Error(`Failed to create system update: ${systemUpdateError.message}`);
    }

    for (let i = 0; i < targetUserIds.length; i += PAGE) {
      const { error } = await admin.from("notification_states").insert(
        targetUserIds.slice(i, i + PAGE).map((userId) => ({
          user_id: userId,
          source_type: "system_update",
          source_id: systemUpdate.id,
          read: false,
        }))
      );
      if (error) {
        // Don't leave a half-sent announcement behind.
        await admin
          .from("notification_states")
          .delete()
          .eq("source_type", "system_update")
          .eq("source_id", systemUpdate.id);
        await admin.from("system_updates").delete().eq("id", systemUpdate.id);
        log.error("Error creating notification states:", error);
        throw new Error(`Failed to create notification states: ${error.message}`);
      }
    }

    log.debug(`Broadcast complete: ${targetUserIds.length} users notified`);
  },
};
