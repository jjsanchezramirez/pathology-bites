import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Create Supabase client with service role for admin operations
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

/**
 * @swagger
 * /api/admin/waitlist:
 *   get:
 *     summary: Get waitlist entries or export as CSV
 *     description: Retrieve paginated waitlist entries or export all entries as CSV. Requires admin role.
 *     tags:
 *       - Admin - Waitlist
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
 *           default: 50
 *         description: Number of entries per page
 *       - in: query
 *         name: export
 *         schema:
 *           type: string
 *           enum: [csv]
 *         description: Export format. When set to 'csv', returns all entries as a downloadable CSV file
 *     responses:
 *       200:
 *         description: Successfully retrieved waitlist entries or CSV export
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
 *                       email:
 *                         type: string
 *                         format: email
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV file with columns Email, Joined Date, ID
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Internal server error
 */
export async function GET(request: Request) {
  try {
    // Auth check - require admin role only
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || userRole !== "admin") {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    // Use service role client for database operations to bypass RLS
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get("export");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Handle CSV export
    if (exportFormat === "csv") {
      const { data: allData, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching waitlist for export:", error);
        return NextResponse.json({ error: "Failed to export waitlist data" }, { status: 500 });
      }

      // Generate CSV content
      const csvHeaders = "Email,Joined Date,ID\n";
      const csvContent = (allData || [])
        .map(
          (entry) =>
            `"${entry.email}","${new Date(entry.created_at).toLocaleDateString()}","${entry.id}"`
        )
        .join("\n");

      const csv = csvHeaders + csvContent;

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="waitlist-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Get waitlist entries with pagination
    const {
      data: waitlistData,
      error: waitlistError,
      count,
    } = await supabase
      .from("waitlist")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (waitlistError) {
      console.error("Error fetching waitlist:", waitlistError);
      return NextResponse.json({ error: "Failed to fetch waitlist data" }, { status: 500 });
    }

    return NextResponse.json({
      data: waitlistData || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Unexpected error in waitlist API:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
