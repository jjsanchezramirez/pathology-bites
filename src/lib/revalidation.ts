/**
 * Cache revalidation utilities for Next.js
 *
 * This module provides centralized cache tag management and revalidation
 * functions to ensure data consistency across the admin interface.
 */

import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Cache tags used throughout the application
 */
export const CACHE_TAGS = {
  // Questions
  QUESTIONS: "questions",
  QUESTIONS_LIST: "questions-list",
  QUESTION_DETAIL: (id: string) => `question-${id}`,
  PENDING_QUESTIONS: "pending-questions",

  // Images
  IMAGES: "images",
  IMAGES_LIST: "images-list",
  IMAGE_DETAIL: (id: string) => `image-${id}`,

  // Dashboard
  DASHBOARD_STATS: "dashboard-stats",
  RECENT_ACTIVITY: "recent-activity",

  // Inquiries
  INQUIRIES: "inquiries",
  PENDING_INQUIRIES: "pending-inquiries",

  // Users
  USERS: "users",
  USER_PROFILE: (id: string) => `user-${id}`,
} as const;

/**
 * Revalidation functions for different data types
 */

export function revalidateQuestions(options?: {
  questionId?: string;
  includeDashboard?: boolean;
}) {
  revalidateTag(CACHE_TAGS.QUESTIONS);
  revalidateTag(CACHE_TAGS.QUESTIONS_LIST);
  revalidateTag(CACHE_TAGS.PENDING_QUESTIONS);

  if (options?.questionId) {
    revalidateTag(CACHE_TAGS.QUESTION_DETAIL(options.questionId));
  }

  if (options?.includeDashboard !== false) {
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS);
    revalidateTag(CACHE_TAGS.RECENT_ACTIVITY);
  }

  // Revalidate admin pages
  revalidatePath("/admin/questions", "page");
  revalidatePath("/admin/review-queue", "page");
  revalidatePath("/admin/my-questions", "page");
  revalidatePath("/admin/dashboard", "page");
}

export function revalidateImages(options?: {
  imageId?: string;
  includeDashboard?: boolean;
}) {
  revalidateTag(CACHE_TAGS.IMAGES);
  revalidateTag(CACHE_TAGS.IMAGES_LIST);

  if (options?.imageId) {
    revalidateTag(CACHE_TAGS.IMAGE_DETAIL(options.imageId));
  }

  if (options?.includeDashboard !== false) {
    revalidateTag(CACHE_TAGS.DASHBOARD_STATS);
  }

  // Revalidate admin pages
  revalidatePath("/admin/images", "page");
  revalidatePath("/admin/dashboard", "page");
}

export function revalidateInquiries() {
  revalidateTag(CACHE_TAGS.INQUIRIES);
  revalidateTag(CACHE_TAGS.PENDING_INQUIRIES);
  revalidateTag(CACHE_TAGS.DASHBOARD_STATS);
  revalidateTag(CACHE_TAGS.RECENT_ACTIVITY);

  // Revalidate admin pages
  revalidatePath("/admin/inquiries", "page");
  revalidatePath("/admin/dashboard", "page");
}

export function revalidateDashboard() {
  revalidateTag(CACHE_TAGS.DASHBOARD_STATS);
  revalidateTag(CACHE_TAGS.RECENT_ACTIVITY);
  revalidatePath("/admin/dashboard", "page");
}

/**
 * Revalidate all admin data
 * Use this sparingly as it clears all caches
 */
export function revalidateAllAdmin() {
  // Revalidate all tags
  Object.values(CACHE_TAGS).forEach((tag) => {
    if (typeof tag === "string") {
      revalidateTag(tag);
    }
  });

  // Revalidate all admin paths
  revalidatePath("/admin", "layout");
}
