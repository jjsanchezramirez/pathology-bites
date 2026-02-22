// src/app/api/admin/notifications/system-update/route.ts
// API endpoint for admins to broadcast system update notifications

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { notificationGenerators } from "@/shared/services/notification-generators";

/**
 * @swagger
 * /api/admin/notifications/system-update:
 *   post:
 *     summary: Broadcast a system update notification
 *     description: Create and broadcast a system update notification to all users or specific audience groups. Requires admin role.
 *     tags:
 *       - Admin - Notifications
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *               - updateType
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the system update notification
 *                 example: "Scheduled Maintenance"
 *               message:
 *                 type: string
 *                 description: Detailed message content for the notification
 *                 example: "The system will be undergoing maintenance on Saturday from 2-4 AM UTC"
 *               updateType:
 *                 type: string
 *                 enum: [maintenance, feature, announcement, security]
 *                 description: Type of system update
 *                 example: "maintenance"
 *               severity:
 *                 type: string
 *                 enum: [info, warning, critical]
 *                 default: info
 *                 description: Severity level of the update
 *                 example: "info"
 *               targetAudience:
 *                 type: string
 *                 enum: [all, admin, user, creator, reviewer]
 *                 default: all
 *                 description: Target audience for the notification
 *                 example: "all"
 *     responses:
 *       201:
 *         description: System update notification broadcasted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "System update notification broadcasted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     message:
 *                       type: string
 *                     updateType:
 *                       type: string
 *                     severity:
 *                       type: string
 *                     targetAudience:
 *                       type: string
 *       400:
 *         description: Bad request - missing required fields or invalid values
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Auth is now handled by middleware

    // Parse request body
    const body = await request.json();
    const { title, message, updateType, severity = "info", targetAudience = "all" } = body;

    // Validate required fields
    if (!title || !message || !updateType) {
      return NextResponse.json(
        { error: "Missing required fields: title, message, updateType" },
        { status: 400 }
      );
    }

    // Validate updateType
    const validUpdateTypes = ["maintenance", "feature", "announcement", "security"];
    if (!validUpdateTypes.includes(updateType)) {
      return NextResponse.json(
        { error: "Invalid updateType. Must be one of: " + validUpdateTypes.join(", ") },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities = ["info", "warning", "critical"];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: "Invalid severity. Must be one of: " + validSeverities.join(", ") },
        { status: 400 }
      );
    }

    // Validate targetAudience
    const validAudiences = ["all", "admin", "user", "creator", "reviewer"];
    if (!validAudiences.includes(targetAudience)) {
      return NextResponse.json(
        { error: "Invalid targetAudience. Must be one of: " + validAudiences.join(", ") },
        { status: 400 }
      );
    }

    // Broadcast the system update
    await notificationGenerators.broadcastSystemUpdate(
      title,
      message,
      updateType,
      severity,
      targetAudience
    );

    return NextResponse.json(
      {
        message: "System update notification broadcasted successfully",
        data: {
          title,
          message,
          updateType,
          severity,
          targetAudience,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error broadcasting system update:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/admin/notifications/system-update:
 *   get:
 *     summary: Get paginated list of system updates
 *     description: Retrieve a paginated list of system update notifications for admin management. Requires admin role.
 *     tags:
 *       - Admin - Notifications
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-indexed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of system updates per page
 *     responses:
 *       200:
 *         description: Successfully retrieved system updates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       updateType:
 *                         type: string
 *                         enum: [maintenance, feature, announcement, security]
 *                       severity:
 *                         type: string
 *                         enum: [info, warning, critical]
 *                       targetAudience:
 *                         type: string
 *                         enum: [all, admin, user, creator, reviewer]
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       description: Current page number
 *                     limit:
 *                       type: integer
 *                       description: Number of items per page
 *                     total:
 *                       type: integer
 *                       description: Total number of system updates
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more pages available
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth is now handled by middleware

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Fetch system updates
    const { data: updates, error: updatesError } = await supabase
      .from("system_updates")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (updatesError) {
      console.error("Error fetching system updates:", updatesError);
      return NextResponse.json({ error: "Failed to fetch system updates" }, { status: 500 });
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from("system_updates")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Error getting system updates count:", countError);
      return NextResponse.json({ error: "Failed to get system updates count" }, { status: 500 });
    }

    return NextResponse.json({
      data: updates,
      pagination: {
        page,
        limit,
        total: count || 0,
        hasMore: (count || 0) > page * limit,
      },
    });
  } catch (error) {
    console.error("Error fetching system updates:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
