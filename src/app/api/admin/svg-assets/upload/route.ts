import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { uploadToR2, generateSvgStoragePath, deleteFromR2 } from "@/shared/services/r2-storage";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";
import { log } from "@/shared/utils/logging";

export const runtime = "nodejs";

/**
 * @swagger
 * /api/admin/svg-assets/upload:
 *   post:
 *     summary: Upload an SVG asset
 *     description: >
 *       Uploads an SVG file to R2 storage and creates an `svg_assets` database record.
 *       SVG content is sanitized (scripts, event handlers, javascript:/data: URIs, iframe/object/embed
 *       are rejected) and dimensions are extracted from viewBox or width/height attributes.
 *       Admin-only; gated by middleware via `x-user-id` plus a `users.role === "admin"` check.
 *     tags:
 *       - Admin - Images
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - name
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The SVG file (image/svg+xml or .svg extension).
 *               name:
 *                 type: string
 *                 description: Display name for the asset (required, non-empty).
 *               description:
 *                 type: string
 *                 description: Optional description.
 *               tags:
 *                 type: string
 *                 description: JSON array string, or comma-separated list of tags.
 *               category:
 *                 type: string
 *                 description: Optional category.
 *     responses:
 *       200:
 *         description: Asset uploaded and record created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 asset:
 *                   type: object
 *                 uploadResult:
 *                   type: object
 *       400:
 *         description: Missing/invalid file or name, or SVG rejected by sanitization
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator privileges required
 *       500:
 *         description: R2 upload or database insert failed
 */
/**
 * POST /api/admin/svg-assets/upload
 * Upload a new SVG asset to R2 storage and create a database record.
 * Includes SVG sanitization to prevent XSS attacks.
 * Requires admin role.
 */
export async function POST(request: NextRequest) {
  let uploadedStoragePath: string | null = null;

  try {
    const supabase = await createClient();

    // Verify user is authenticated admin
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required. Please log in to upload SVG assets." },
        { status: 401 }
      );
    }

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json(
        { error: "Administrator privileges required to upload SVG assets." },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const tagsJson = formData.get("tags") as string | null;
    const category = formData.get("category") as string | null;

    // Validation: File presence
    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Please select an SVG file to upload." },
        { status: 400 }
      );
    }

    // Validation: File type
    const isSvgType = file.type === "image/svg+xml";
    const isSvgExtension = file.name.toLowerCase().endsWith(".svg");
    if (!isSvgType && !isSvgExtension) {
      return NextResponse.json(
        { error: "Invalid file type. Only SVG files are allowed." },
        { status: 400 }
      );
    }

    // Validation: File name
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    // Read SVG content as text
    let svgText: string;
    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(await file.arrayBuffer());
      svgText = fileBuffer.toString("utf-8");
    } catch (error) {
      log.error("Failed to read SVG file:", error);
      return NextResponse.json(
        { error: "Failed to read SVG file. The file may be corrupted." },
        { status: 400 }
      );
    }

    // SVG sanitization - reject dangerous content
    const dangerousPatterns = [
      /<script/i,
      /on[a-z]+\s*=/i,
      /javascript\s*:/i,
      /data\s*:/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(svgText)) {
        return NextResponse.json(
          {
            error:
              "SVG file contains potentially dangerous content and was rejected for security reasons.",
          },
          { status: 400 }
        );
      }
    }

    // Extract dimensions from SVG
    let width: number | null = null;
    let height: number | null = null;

    // Try viewBox first (format: "x y width height")
    const viewBoxMatch = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
      if (parts.length === 4) {
        width = parseFloat(parts[2]);
        height = parseFloat(parts[3]);
      }
    }

    // Fall back to width/height attributes if viewBox didn't work
    if (!width || !height) {
      const widthMatch = svgText.match(/<svg[^>]*\bwidth\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i);
      const heightMatch = svgText.match(/<svg[^>]*\bheight\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i);
      if (widthMatch) width = parseFloat(widthMatch[1]);
      if (heightMatch) height = parseFloat(heightMatch[1]);
    }

    // Parse tags
    let tags: string[] | null = null;
    if (tagsJson) {
      try {
        tags = JSON.parse(tagsJson);
      } catch {
        // If not valid JSON, treat as comma-separated string
        tags = tagsJson
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }

    // Generate R2 storage path
    const storagePath = generateSvgStoragePath(name.trim());
    uploadedStoragePath = storagePath;

    // Step 1: Upload to R2
    let uploadResult;
    try {
      uploadResult = await uploadToR2(fileBuffer, storagePath, {
        contentType: "image/svg+xml",
        // Path includes a timestamp prefix — URL is the cache key.
        cacheControl: "public, max-age=31536000, immutable",
        metadata: {
          originalName: file.name.replace(/[^\x20-\x7E]/g, "_"),
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      log.error("R2 upload failed:", error);
      uploadedStoragePath = null;
      return NextResponse.json(
        { error: "Failed to upload SVG to storage. Please try again." },
        { status: 500 }
      );
    }

    // Step 2: Insert database record
    const { data: svgData, error: dbError } = await supabase
      .from("svg_assets")
      .insert({
        url: uploadResult.url,
        storage_path: storagePath,
        name: name.trim(),
        description: description?.trim() || null,
        tags: tags,
        category: category?.trim() || null,
        width,
        height,
        file_size_bytes: fileBuffer.length,
        created_by: userId,
      })
      .select()
      .single();

    if (dbError) {
      log.error("Database insert failed:", dbError);

      // Clean up R2 storage on database error
      try {
        log.debug("Cleaning up R2 file after database error:", storagePath);
        await deleteFromR2(storagePath);
        log.debug("R2 cleanup successful");
      } catch (cleanupError) {
        log.error("CRITICAL: Failed to cleanup R2 file after database error:", cleanupError);
        log.error("Orphaned file at:", storagePath);
      }

      uploadedStoragePath = null;

      return NextResponse.json(
        { error: `Failed to save SVG metadata: ${dbError.message || "Unknown database error"}` },
        { status: 500 }
      );
    }

    // Success
    uploadedStoragePath = null;

    return NextResponse.json({
      success: true,
      asset: svgData,
      uploadResult: {
        url: uploadResult.url,
        key: uploadResult.key,
        size: uploadResult.size,
        contentType: uploadResult.contentType,
      },
    });
  } catch (error) {
    log.error("SVG upload error:", error);

    // Clean up orphaned R2 file
    if (uploadedStoragePath) {
      try {
        log.debug("Cleaning up orphaned R2 file after unexpected error:", uploadedStoragePath);
        await deleteFromR2(uploadedStoragePath);
        log.debug("Emergency R2 cleanup successful");
      } catch (cleanupError) {
        log.error("CRITICAL: Failed emergency cleanup of R2 file:", cleanupError);
        log.error("Orphaned file at:", uploadedStoragePath);
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Upload failed: ${errorMessage}. Please try again.` },
      { status: 500 }
    );
  }
}
