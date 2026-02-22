// src/app/api/dashboard/activities/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

// Simple activity types - keeping it focused
const ACTIVITY_TYPES = {
  quiz_completed: "Quiz Completed",
  quiz_started: "Quiz Started",
  subject_mastered: "Subject Mastered",
  study_streak: "Study Streak",
  performance_milestone: "Performance Milestone",
  badge_earned: "Badge Earned",
  weak_area_improved: "Weak Area Improved",
} as const;

// Simple time grouping
function getGroupKey(date: Date): string {
  const now = new Date();
  const activityDate = new Date(date);
  const diffDays = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return "this_week";
  if (diffDays <= 14) return "last_week";
  return "earlier";
}

function getGroupTitle(groupKey: string): string {
  const titles: Record<string, string> = {
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This Week",
    last_week: "Last Week",
    earlier: "Earlier",
  };
  return titles[groupKey] || groupKey;
}

/**
 * @swagger
 * /api/user/dashboard/activities:
 *   get:
 *     summary: Get user's activity feed
 *     description: Retrieve user's recent activities grouped by time period (today, yesterday, this week, etc.). Requires authentication.
 *     tags:
 *       - User - Dashboard
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of activities to return
 *     responses:
 *       200:
 *         description: Activities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     groups:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: string
 *                             enum: [today, yesterday, this_week, last_week, earlier]
 *                           title:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           activities:
 *                             type: array
 *                             items:
 *                               type: object
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         unread:
 *                           type: integer
 *                         byType:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build query - simple, no filtering
    const { data: activities, error } = await supabase
      .from("user_activities")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching activities:", error);
      return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
    }

    // Group activities by time
    const grouped = new Map();

    activities?.forEach((activity) => {
      const groupKey = getGroupKey(new Date(activity.created_at));

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          key: groupKey,
          title: getGroupTitle(groupKey),
          activities: [],
          count: 0,
        });
      }

      grouped.get(groupKey).activities.push(activity);
      grouped.get(groupKey).count++;
    });

    // Sort groups by priority
    const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
      const priority = ["today", "yesterday", "this_week", "last_week", "earlier"];
      return priority.indexOf(a.key) - priority.indexOf(b.key);
    });

    // Simple stats
    const stats = {
      total: activities?.length || 0,
      unread: activities?.filter((a) => !a.is_read).length || 0,
      byType:
        activities?.reduce(
          (acc, activity) => {
            acc[activity.type] = (acc[activity.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {},
    };

    return NextResponse.json({
      success: true,
      data: {
        groups: sortedGroups,
        stats,
      },
    });
  } catch (error) {
    console.error("Error in activities API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/dashboard/activities:
 *   post:
 *     summary: Create a new activity
 *     description: Create a new activity entry for the user. Activities track user actions like quiz completion, achievements, etc. Requires authentication.
 *     tags:
 *       - User - Dashboard
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [quiz_completed, quiz_started, subject_mastered, study_streak, performance_milestone, badge_earned, weak_area_improved]
 *                 description: Type of activity
 *               title:
 *                 type: string
 *                 description: Activity title
 *               description:
 *                 type: string
 *                 description: Activity description
 *               quiz_id:
 *                 type: string
 *                 format: uuid
 *                 description: Related quiz session ID (if applicable)
 *               subject_id:
 *                 type: string
 *                 format: uuid
 *                 description: Related subject/category ID (if applicable)
 *               data:
 *                 type: object
 *                 description: Additional activity data
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *                 description: Activity priority level
 *     responses:
 *       200:
 *         description: Activity created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Created activity object
 *       400:
 *         description: Bad request - missing required fields or invalid activity type
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, title, description, quiz_id, subject_id, data = {}, priority = "medium" } = body;

    // Validate required fields
    if (!type || !title) {
      return NextResponse.json({ error: "Type and title are required" }, { status: 400 });
    }

    // Validate activity type
    if (!Object.keys(ACTIVITY_TYPES).includes(type)) {
      return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
    }

    const now = new Date();
    const groupKey = getGroupKey(now);

    const { data: activity, error } = await supabase
      .from("user_activities")
      .insert({
        user_id: userId,
        type,
        title,
        description,
        quiz_id,
        subject_id,
        data,
        priority,
        group_key: groupKey,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating activity:", error);
      return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Error in activities POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
