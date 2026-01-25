import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const bulkDeleteSchema = z.object({
  inquiryIds: z
    .array(z.string().uuid())
    .min(1, "At least one inquiry ID is required")
    .max(100, "Cannot delete more than 100 inquiries at once"),
});

// Create Supabase client with service role for admin operations (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

export async function DELETE(request: NextRequest) {
  try {
    console.log("Bulk delete inquiries API called");

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

    // Parse and validate request body
    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { inquiryIds } = validation.data;

    console.log(
      `Attempting to delete ${inquiryIds.length} inquiries by user ${userId}:`,
      inquiryIds
    );

    // First, verify all inquiries exist and get their details for logging
    const { data: existingInquiries, error: fetchError } = await supabase
      .from("inquiries")
      .select("id, first_name, last_name, email, request_type, status")
      .in("id", inquiryIds);

    if (fetchError) {
      console.error("Error fetching inquiries for verification:", fetchError);
      return NextResponse.json({ error: "Failed to verify inquiries" }, { status: 500 });
    }

    const foundIds = existingInquiries?.map((inquiry) => inquiry.id) || [];
    const notFoundIds = inquiryIds.filter((id) => !foundIds.includes(id));

    if (notFoundIds.length > 0) {
      console.warn("Some inquiries not found:", notFoundIds);
      return NextResponse.json(
        {
          error: "Some inquiries not found",
          notFoundIds,
          foundCount: foundIds.length,
        },
        { status: 404 }
      );
    }

    // Perform bulk delete
    const { error: deleteError } = await supabase.from("inquiries").delete().in("id", inquiryIds);

    if (deleteError) {
      console.error("Error deleting inquiries:", deleteError);
      return NextResponse.json({ error: "Failed to delete inquiries" }, { status: 500 });
    }

    const deletedCount = inquiryIds.length;
    console.log(`Successfully deleted ${deletedCount} inquiries`);

    // Log the deletion for audit purposes
    console.log(
      "Deleted inquiries:",
      existingInquiries?.map((inquiry) => ({
        id: inquiry.id,
        contact: `${inquiry.first_name} ${inquiry.last_name} (${inquiry.email})`,
        type: inquiry.request_type,
        status: inquiry.status,
      }))
    );

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount,
      message: `Successfully deleted ${deletedCount} inquiries`,
    });
  } catch (error) {
    console.error("Unexpected error in bulk delete:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
