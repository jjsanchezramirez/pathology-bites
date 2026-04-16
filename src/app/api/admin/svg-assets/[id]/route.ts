import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { deleteFromR2 } from "@/shared/services/r2-storage";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

/**
 * DELETE /api/admin/svg-assets/[id]
 * Delete an SVG asset from both R2 storage and the database.
 * Requires admin role.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify user is authenticated admin
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Administrator privileges required." }, { status: 403 });
    }

    // Fetch asset details
    const { data: asset, error: fetchError } = await supabase
      .from("svg_assets")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: "SVG asset not found." }, { status: 404 });
    }

    // Delete from R2 storage
    if (asset.storage_path) {
      try {
        await deleteFromR2(asset.storage_path);
      } catch (storageError) {
        console.warn("R2 deletion error (continuing with database deletion):", storageError);
      }
    }

    // Delete from database
    const { error: dbError } = await supabase.from("svg_assets").delete().eq("id", id);

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to delete SVG asset from database." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "SVG asset deleted successfully.",
    });
  } catch (error) {
    console.error("SVG asset deletion error:", error);
    return NextResponse.json({ error: "Failed to delete SVG asset." }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/svg-assets/[id]
 * Update SVG asset metadata (name, description, tags, category).
 * Requires admin role.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify user is authenticated admin
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Administrator privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description || null;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.category !== undefined) updates.category = body.category || null;

    updates.updated_at = new Date().toISOString();

    const { data, error: dbError } = await supabase
      .from("svg_assets")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: `Failed to update SVG asset: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      asset: data,
    });
  } catch (error) {
    console.error("SVG asset update error:", error);
    return NextResponse.json({ error: "Failed to update SVG asset." }, { status: 500 });
  }
}
