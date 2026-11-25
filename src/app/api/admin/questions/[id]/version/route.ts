import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";

// Snapshots are written by the save_question / transition_question database functions on
// every save; there is no separate "create version" call any more.

/**
 * @swagger
 * /api/admin/questions/{id}/version:
 *   get:
 *     summary: Question version history
 *     description: >
 *       Lists the stored snapshots of a question, newest first. Every save and status change
 *       stores a full after-save snapshot (snapshot_format 2); rows marked `legacy` predate
 *       full snapshots and have partial, inconsistent shapes. The newest row is marked current.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Version history (possibly empty)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Auth is handled by middleware - get user ID from headers
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { id: questionId } = await params;
    log.debug("Version history API called for question:", questionId, "by user:", userId);

    // Use admin client to fetch version history
    const adminClient = await createServiceRoleClient();

    // Fetch ALL versions from question_versions table (including v1.0.0)
    const { data: versions, error: versionsError } = await adminClient
      .from("question_versions")
      .select(
        `
        id,
        version_major,
        version_minor,
        version_patch,
        update_type,
        change_summary,
        question_data,
        created_at,
        changed_by,
        legacy
      `
      )
      .eq("question_id", questionId)
      // Newest first. Every save writes an after-save snapshot, so several rows can share a
      // version number (draft edits, status changes); time is the reliable order.
      .order("created_at", { ascending: false });

    if (versionsError) {
      log.error("Error fetching version history:", versionsError);
      return NextResponse.json({ error: "Failed to fetch version history" }, { status: 500 });
    }

    if (!versions || versions.length === 0) {
      return NextResponse.json({
        success: true,
        versions: [],
      });
    }

    // Fetch all changer users in ONE query (was N+1: a users lookup per version).
    const changerIds = [...new Set(versions.map((v) => v.changed_by).filter(Boolean))];
    const { data: changers } = changerIds.length
      ? await adminClient
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", changerIds)
      : { data: [] };
    const changerById = new Map((changers || []).map((u) => [u.id, u]));

    // The newest snapshot is the question as it stands now.
    const versionsWithUsers = versions.map((version, index) => {
      return {
        ...version,
        changer: changerById.get(version.changed_by) || {
          first_name: "Unknown",
          last_name: "User",
          email: "",
        },
        is_current: index === 0,
      };
    });

    return NextResponse.json({
      success: true,
      versions: versionsWithUsers,
    });
  } catch (error) {
    log.error("Error in version history API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
