import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Resend } from "resend";
import { createAdminResponseEmail } from "@/shared/config/email-templates";
import { log } from "@/shared/utils/logging";

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const responseSchema = z.object({
  response: z.string().min(1, "Response is required"),
});

// Create Supabase client with service role for admin operations (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

/**
 * @swagger
 * /api/admin/inquiries/{id}/respond:
 *   post:
 *     summary: Send email response to an inquiry
 *     description: Send an email response to a user's inquiry. The response is sent via Resend using the verified pathologybites.com domain. After successfully sending the email, the inquiry status is automatically updated to "resolved". Requires admin role.
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
 *         description: The unique identifier of the inquiry to respond to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *                 minLength: 1
 *                 description: The response message to send to the user
 *                 example: Thank you for your inquiry. We have reviewed your request and...
 *     responses:
 *       200:
 *         description: Response sent successfully and inquiry marked as resolved
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
 *                   example: Response sent successfully and inquiry marked as resolved
 *       400:
 *         description: Bad request - missing or invalid response text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid request data
 *                 details:
 *                   type: array
 *                   description: Validation error details
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
 *         description: Internal server error or email sending failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to send email response
 *                 details:
 *                   type: object
 *                   description: Error details from email service
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    log.debug("Inquiry response API called for ID:", params.id);

    // Auth check - require admin role only
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || userRole !== "admin") {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    // Use admin client for database operations (bypasses RLS)
    const supabase = createAdminClient();
    const inquiryId = params.id;

    // Parse request body
    const body = await request.json();
    const validation = responseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { response } = validation.data;

    // Get the inquiry details
    log.debug("Fetching inquiry with ID:", inquiryId);
    const { data: inquiry, error: inquiryError } = await supabase
      .from("inquiries")
      .select("*")
      .eq("id", inquiryId)
      .single();

    if (inquiryError || !inquiry) {
      log.error("Inquiry not found:", inquiryError);
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    log.debug("Found inquiry:", inquiry.id, "from", inquiry.email);

    // Check if Resend is configured
    if (!resend) {
      log.warn("Resend API key not configured - running in test mode");
      // In test mode, just log the response instead of sending email
      log.debug("TEST MODE - Would send email response:", {
        to: inquiry.email,
        response: response,
        inquiryId,
      });

      return NextResponse.json({
        success: true,
        message: "Response logged successfully (test mode - no email sent)",
      });
    }

    // Send email response
    try {
      log.debug("Attempting to send email to:", inquiry.email);

      // Create professional email using the template
      const emailContent = createAdminResponseEmail({
        firstName: inquiry.first_name,
        lastName: inquiry.last_name,
        requestType: inquiry.request_type,
        originalInquiry: inquiry.inquiry,
        response: response,
      });

      // Use verified pathologybites.com domain
      const emailResult = await resend!.emails.send({
        from: "Pathology Bites <contact@pathologybites.com>",
        to: [inquiry.email],
        subject: `Re: Your ${inquiry.request_type === "general" ? "General" : "Technical Support"} Inquiry`,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (emailResult.error) {
        log.error("Email sending failed:", emailResult.error);
        return NextResponse.json(
          { error: "Failed to send email response", details: emailResult.error },
          { status: 500 }
        );
      }

      log.debug("Email sent successfully to:", inquiry.email);

      // Auto-resolve the inquiry after successful response
      const { error: updateError } = await supabase
        .from("inquiries")
        .update({
          status: "resolved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", inquiryId);

      if (updateError) {
        log.error("Failed to update inquiry status to resolved:", updateError);
        // Don't fail the request since email was sent successfully
      } else {
        log.debug("Inquiry status updated to resolved:", inquiryId);
      }

      return NextResponse.json({
        success: true,
        message: "Response sent successfully and inquiry marked as resolved",
      });
    } catch (emailError) {
      log.error("Error sending email:", emailError);
      return NextResponse.json({ error: "Failed to send email response" }, { status: 500 });
    }
  } catch (error) {
    log.error("Error responding to inquiry:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
