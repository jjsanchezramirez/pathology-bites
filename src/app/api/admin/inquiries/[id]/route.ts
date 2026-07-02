import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/inquiries/{id}:
 *   delete:
 *     summary: Delete a single inquiry
 *     description: Delete a specific inquiry by its ID. The inquiry details are returned in the response for audit purposes. Requires admin role.
 *     tags:
 *       - Admin - Inquiries
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique identifier of the inquiry to delete
 *     responses:
 *       200:
 *         description: Inquiry deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Inquiry deleted successfully
 *                 deletedInquiry:
 *                   type: object
 *                   description: The deleted inquiry object for audit purposes
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Inquiry not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Inquiry not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    log.debug("Deleting inquiry with ID:", resolvedParams.id);

    // Auth check - require admin role only
    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    // Use admin client for database operations (bypasses RLS)
    const supabase = createServiceRoleClient();
    const inquiryId = resolvedParams.id;

    // First, get the inquiry to return its details
    const { data: inquiry, error: fetchError } = await supabase
      .from("inquiries")
      .select("*")
      .eq("id", inquiryId)
      .single();

    if (fetchError || !inquiry) {
      log.error("Inquiry not found:", fetchError);
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    // Delete the inquiry
    const { error: deleteError } = await supabase.from("inquiries").delete().eq("id", inquiryId);

    if (deleteError) {
      log.error("Failed to delete inquiry:", deleteError);
      return NextResponse.json({ error: "Failed to delete inquiry" }, { status: 500 });
    }

    log.debug("Inquiry deleted successfully:", inquiryId);

    return NextResponse.json({
      success: true,
      message: "Inquiry deleted successfully",
      deletedInquiry: inquiry,
    });
  } catch (error) {
    log.error("Error deleting inquiry:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
