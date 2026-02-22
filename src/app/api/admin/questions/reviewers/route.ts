import { createClient } from "@/shared/services/server";
import { NextResponse } from "next/server";

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

    // Get all users with admin or reviewer role
    const { data: reviewers, error: reviewersError } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, role")
      .in("role", ["admin", "reviewer"])
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (reviewersError) {
      console.error("Error fetching reviewers:", reviewersError);
      return NextResponse.json({ error: "Failed to fetch reviewers" }, { status: 500 });
    }

    // Get workload for each reviewer (count of pending_review questions)
    const reviewerIds = reviewers.map((r) => r.id);

    const { data: workloadData, error: workloadError } = await supabase
      .from("questions")
      .select("reviewer_id")
      .in("reviewer_id", reviewerIds)
      .eq("status", "pending_review");

    if (workloadError) {
      console.error("Error fetching workload:", workloadError);
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
    console.error("Unexpected error fetching reviewers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
