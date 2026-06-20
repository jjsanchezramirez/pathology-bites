import { createClient } from "@/shared/services/server";
import { NextResponse } from "next/server";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/questions/reviewers:
 *   get:
 *     summary: Get list of available reviewers
 *     description: Retrieve all users with admin or reviewer role, including their current workload (number of pending review questions assigned). Requires admin, creator, or reviewer role.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved reviewers with workload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviewers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       email:
 *                         type: string
 *                       first_name:
 *                         type: string
 *                       last_name:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                         description: Computed full name or email if name not available
 *                       role:
 *                         type: string
 *                         enum: [admin, reviewer]
 *                       pending_count:
 *                         type: integer
 *                         description: Number of pending review questions assigned
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - requires admin, creator, or reviewer role
 *       500:
 *         description: Internal server error
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Auth check - require admin, creator, or reviewer role
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || !["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    // Parallel: reviewers list + workload (all pending_review questions). Workload query
    // intentionally doesn't filter on reviewer_ids — they aren't known yet, and the result
    // set is small (pending_review count is bounded). Saves a round-trip vs sequential.
    const [reviewersResult, workloadResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, email, first_name, last_name, role")
        .in("role", ["admin", "reviewer"])
        .eq("status", "active")
        .order("first_name", { ascending: true }),
      supabase.from("questions").select("reviewer_id").eq("status", "pending_review"),
    ]);

    const { data: reviewers, error: reviewersError } = reviewersResult;
    const { data: workloadData, error: workloadError } = workloadResult;

    if (reviewersError) {
      log.error("Error fetching reviewers:", reviewersError);
      return NextResponse.json({ error: "Failed to fetch reviewers" }, { status: 500 });
    }

    if (workloadError) {
      log.error("Error fetching workload:", workloadError);
      // Continue without workload data
    }

    // Calculate workload per reviewer
    const workloadMap = new Map<string, number>();
    if (workloadData) {
      workloadData.forEach((q) => {
        if (q.reviewer_id) {
          workloadMap.set(q.reviewer_id, (workloadMap.get(q.reviewer_id) || 0) + 1);
        }
      });
    }

    // Format response with workload
    const reviewersWithWorkload = reviewers.map((reviewer) => ({
      id: reviewer.id,
      email: reviewer.email,
      first_name: reviewer.first_name,
      last_name: reviewer.last_name,
      full_name: reviewer.first_name
        ? reviewer.last_name
          ? `${reviewer.first_name} ${reviewer.last_name}`
          : reviewer.first_name
        : reviewer.email,
      role: reviewer.role,
      pending_count: workloadMap.get(reviewer.id) || 0,
    }));

    return NextResponse.json({
      reviewers: reviewersWithWorkload,
    });
  } catch (error) {
    log.error("Unexpected error fetching reviewers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
