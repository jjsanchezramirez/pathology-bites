import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { formatVersion } from "@/shared/utils/version";

// Create Supabase client with service role for admin operations
async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

/**
 * @swagger
 * /api/admin/questions/{id}/version:
 *   post:
 *     summary: Create new question version
 *     description: Manually create a new version of an approved question. Requires admin role.
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
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               changeSummary:
 *                 type: string
 *                 description: Summary of changes made
 *     responses:
 *       200:
 *         description: Version created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 versionId:
 *                   type: string
 *                   format: uuid
 *                 question:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - question must be approved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: Get question version history
 *     description: Retrieve all versions of a question ordered by version number. Requires authentication.
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
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Successfully retrieved version history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 versions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       version_major:
 *                         type: integer
 *                       version_minor:
 *                         type: integer
 *                       version_patch:
 *                         type: integer
 *                       update_type:
 *                         type: string
 *                         enum: [initial, patch, minor, major]
 *                       change_summary:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       changer:
 *                         type: object
 *                       is_current:
 *                         type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;
    const userId = request.headers.get("x-user-id"); // Still need user ID for changed_by
    const body = await request.json();
    const changeSummary = body.changeSummary;

    // Use admin client for the actual operations
    const adminClient = await createAdminClient();

    // Check if question exists and is published (only published questions can be versioned)
    const { data: question, error: questionError } = await adminClient
      .from("questions")
      .select("id, status, version_major, version_minor, version_patch")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    if (question.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved questions can be versioned" },
        { status: 400 }
      );
    }

    // Create version using simplified versioning function
    const { data: versionId, error: versionError } = await adminClient.rpc(
      "create_question_version_simplified",
      {
        question_id_param: questionId,
        change_summary_param: changeSummary || "Manual version creation",
        changed_by_param: userId,
      }
    );

    if (versionError) {
      console.error("Error updating question version:", versionError);
      return NextResponse.json({ error: "Failed to update question version" }, { status: 500 });
    }

    // Get updated question data
    const { data: updatedQuestion, error: fetchError } = await adminClient
      .from("questions")
      .select("id, version_major, version_minor, version_patch, updated_at")
      .eq("id", questionId)
      .single();

    if (fetchError) {
      console.error("Error fetching updated question:", fetchError);
      return NextResponse.json(
        { error: "Question updated but failed to fetch updated data" },
        { status: 500 }
      );
    }

    const versionString = formatVersion(
      updatedQuestion.version_major,
      updatedQuestion.version_minor,
      updatedQuestion.version_patch,
      false
    );

    return NextResponse.json({
      success: true,
      versionId,
      question: updatedQuestion,
      message: `Question updated to version ${versionString}`,
    });
  } catch (error) {
    console.error("Error in question versioning API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to fetch version history
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Auth is handled by middleware - get user ID from headers
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: questionId } = await params;
    console.log("Version history API called for question:", questionId, "by user:", userId);

    // Use admin client to fetch version history
    const adminClient = await createAdminClient();

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
        changed_by
      `
      )
      .eq("question_id", questionId)
      .order("version_major", { ascending: false })
      .order("version_minor", { ascending: false })
      .order("version_patch", { ascending: false });

    if (versionsError) {
      console.error("Error fetching version history:", versionsError);
      return NextResponse.json({ error: "Failed to fetch version history" }, { status: 500 });
    }

    if (!versions || versions.length === 0) {
      return NextResponse.json({
        success: true,
        versions: [],
      });
    }

    // Get the current question's version to mark which one is current
    const { data: currentQuestion } = await adminClient
      .from("questions")
      .select("version_major, version_minor, version_patch")
      .eq("id", questionId)
      .single();

    // Fetch user data for each version
    const versionsWithUsers = await Promise.all(
      versions.map(async (version, index) => {
        const { data: user } = await adminClient
          .from("users")
          .select("first_name, last_name, email")
          .eq("id", version.changed_by)
          .single();

        // Mark the version that matches current question as current
        const isCurrent =
          currentQuestion &&
          version.version_major === currentQuestion.version_major &&
          version.version_minor === currentQuestion.version_minor &&
          version.version_patch === currentQuestion.version_patch;

        return {
          ...version,
          changer: user || { first_name: "Unknown", last_name: "User", email: "" },
          is_current: isCurrent || index === 0, // Fallback to first if no match
        };
      })
    );

    return NextResponse.json({
      success: true,
      versions: versionsWithUsers,
    });
  } catch (error) {
    console.error("Error in version history API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
