import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const statusUpdateSchema = z.object({
  status: z.enum(["pending", "resolved", "closed"]),
});

// Create Supabase client with service role for admin operations (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    console.log("Updating inquiry status for ID:", resolvedParams.id);

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
    const inquiryId = resolvedParams.id;

    // Parse request body
    const body = await request.json();
    const validation = statusUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { status } = validation.data;

    // Update inquiry status
    const { data: updatedInquiry, error: updateError } = await supabase
      .from("inquiries")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiryId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update inquiry status:", updateError);
      return NextResponse.json({ error: "Failed to update inquiry status" }, { status: 500 });
    }

    if (!updatedInquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    console.log("Inquiry status updated successfully:", updatedInquiry.id, "to", status);

    return NextResponse.json({
      success: true,
      message: `Inquiry status updated to ${status}`,
      inquiry: updatedInquiry,
    });
  } catch (error) {
    console.error("Error updating inquiry status:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
