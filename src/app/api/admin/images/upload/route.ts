import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { uploadToR2, generateImageStoragePath, deleteFromR2 } from "@/shared/services/r2-storage";
import { getImageDimensionsFromFile } from "@/shared/utils/images/server-image-utils";
import { requireUser } from "@/shared/utils/api/api-guard";
import { isImageCategory } from "@/shared/types/database";
import { parseImageFilename } from "@/shared/utils/images/filename-parser";
import { revalidateImages } from "@/shared/utils/api/revalidation";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/images/upload:
 *   post:
 *     summary: Upload a new image
 *     description: Upload a new image to R2 storage and create a database record. The image is automatically parsed for pathology metadata (category, magnification, title, description, source). Filename format "Title - Description [40x][M][PathologyCategory][Src=xxx].ext" where all metadata is in square brackets. Includes validation for file type, size, and dimensions. Requires admin role.
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
 *               - category
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The image file to upload (max 10MB, max 10000x10000 pixels). Filename is parsed for metadata.
 *               category:
 *                 type: string
 *                 enum: [microscopic, gross, figure, table]
 *                 description: The image category
 *               description:
 *                 type: string
 *                 description: Optional description for the image. Priority - form value > parsed description (after " - ") > parsed title
 *               sourceRef:
 *                 type: string
 *                 description: Optional reference to the source of the image
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 image:
 *                   type: object
 *                   description: The created image record with all metadata
 *                 uploadResult:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: The public URL of the uploaded image
 *                     key:
 *                       type: string
 *                       description: The R2 storage key
 *                     size:
 *                       type: integer
 *                       description: File size in bytes
 *                     contentType:
 *                       type: string
 *                       example: image/jpeg
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     noFile:
 *                       value: No file provided. Please select an image to upload.
 *                     noCategory:
 *                       value: Image category is required.
 *                     invalidCategory:
 *                       value: Invalid category. Must be one of microscopic, gross, figure, table
 *                     invalidFileType:
 *                       value: Invalid file type. Only image files are allowed.
 *                     fileTooLarge:
 *                       value: File too large. Maximum size is 10MB. Your file is 12.34MB.
 *                     invalidFileName:
 *                       value: Invalid file name.
 *                     dimensionsTooLarge:
 *                       value: Image dimensions too large. Maximum 10000x10000 pixels.
 *                     invalidDimensions:
 *                       value: Invalid image dimensions.
 *                     corruptedFile:
 *                       value: Failed to read image file. The file may be corrupted.
 *                     invalidImage:
 *                       value: Failed to read image dimensions. The file may not be a valid image.
 *       401:
 *         description: Unauthorized - missing authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Authentication required. Please log in to upload images.
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Administrator privileges required to upload images.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     uploadFailed:
 *                       value: Failed to upload image to storage. Please try again.
 *                     databaseFailed:
 *                       value: "Failed to save image metadata: [error details]"
 *                     genericError:
 *                       value: "Upload failed: [error message]. Please try again."
 */
export async function POST(request: NextRequest) {
  let uploadedStoragePath: string | null = null;

  try {
    const supabase = await createClient();

    // Verify user is authenticated admin
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json(
        { error: "Administrator privileges required to upload images." },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string;
    const sourceRef = formData.get("sourceRef") as string | null;
    const description = formData.get("description") as string | null;
    const magnificationOverride = formData.get("magnification") as string | null;
    const pathologyCategoryOverride = formData.get("pathologyCategory") as string | null;

    // Validation: File presence
    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Please select an image to upload." },
        { status: 400 }
      );
    }

    // Validation: Category
    if (!category) {
      return NextResponse.json({ error: "Image category is required." }, { status: 400 });
    }

    const validCategories = ["microscopic", "gross", "figure", "table"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Validation: File type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file type. Only image files are allowed." },
        { status: 400 }
      );
    }

    // Validation: File size (max 10MB before compression)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
        },
        { status: 400 }
      );
    }

    // Validation: File name
    if (!file.name || file.name.trim() === "") {
      return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
    }

    // Get image dimensions and buffer
    let fileBuffer: Buffer;
    let dimensions: { width: number; height: number };

    try {
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } catch (error) {
      log.error("Failed to read file buffer:", error);
      return NextResponse.json(
        { error: "Failed to read image file. The file may be corrupted." },
        { status: 400 }
      );
    }

    try {
      dimensions = await getImageDimensionsFromFile(file);
    } catch (error) {
      log.error("Failed to get image dimensions:", error);
      return NextResponse.json(
        { error: "Failed to read image dimensions. The file may not be a valid image." },
        { status: 400 }
      );
    }

    // Validation: Image dimensions (reasonable limits)
    const MAX_DIMENSION = 10000;
    if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
      return NextResponse.json(
        { error: `Image dimensions too large. Maximum ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.` },
        { status: 400 }
      );
    }

    if (dimensions.width < 1 || dimensions.height < 1) {
      return NextResponse.json({ error: "Invalid image dimensions." }, { status: 400 });
    }

    // Parse filename to extract pathology category, magnification, image category, and source
    const parsedFilename = parseImageFilename(file.name);
    log.debug("Parsed filename:", parsedFilename);

    // Use form data overrides if provided, otherwise fall back to parsed values
    const pathologyCategoryId = pathologyCategoryOverride || parsedFilename.categoryId;
    const magnification = magnificationOverride || parsedFilename.magnification;
    const rawImageCategory = parsedFilename.imageCategory || category; // Use parsed category if available
    if (!isImageCategory(rawImageCategory)) {
      // The DB enum would have rejected this anyway — fail early with a clear message
      return NextResponse.json(
        { error: `Invalid image category: ${rawImageCategory}` },
        { status: 400 }
      );
    }
    const finalImageCategory = rawImageCategory;
    const finalSourceRef = sourceRef || parsedFilename.sourceRef; // Use parsed source if no form data

    if (pathologyCategoryId) {
      const source = pathologyCategoryOverride ? "form data" : "filename";
      log.debug(`Pathology category ID (from ${source}): ${pathologyCategoryId}`);
    }

    if (magnification) {
      const source = magnificationOverride ? "form data" : "filename";
      log.debug(`Magnification (from ${source}): ${magnification}`);
    }

    if (parsedFilename.imageCategory) {
      log.debug(`Image category (from filename): ${parsedFilename.imageCategory}`);
    }

    if (parsedFilename.description) {
      log.debug(`Description (from filename): ${parsedFilename.description}`);
    }

    if (finalSourceRef) {
      const source = sourceRef ? "form data" : "filename";
      log.debug(`Source reference (from ${source}): ${finalSourceRef}`);
    }

    // Generate R2 storage path using only the title (no description or metadata)
    const fileExtension = file.name.split(".").pop() || "jpg";
    const storagePath = generateImageStoragePath(
      parsedFilename.title,
      fileExtension,
      finalImageCategory
    );
    uploadedStoragePath = storagePath; // Track for cleanup

    // Step 1: Upload to R2
    let uploadResult;
    try {
      uploadResult = await uploadToR2(fileBuffer, storagePath, {
        contentType: file.type,
        // New uploads land at a unique timestamp-prefixed key (see
        // `generateImageStoragePath`), so the URL itself is the cache key
        // and immutable + 1-year is safe. Replacement uploads overwrite at
        // the same key and use a much shorter TTL — see
        // /api/admin/images/replace.
        cacheControl: "public, max-age=31536000, immutable",
        metadata: {
          // Sanitize filename for HTTP headers (only ASCII printable characters)
          originalName: file.name.replace(/[^\x20-\x7E]/g, "_"),
          category: finalImageCategory,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      log.error("R2 upload failed:", error);
      uploadedStoragePath = null; // Reset since upload failed
      return NextResponse.json(
        { error: "Failed to upload image to storage. Please try again." },
        { status: 500 }
      );
    }

    // Step 2: Insert database record with metadata
    // Use parsed title and description from filename
    const imageTitle = parsedFilename.title;
    const parsedDescription = parsedFilename.description;

    // Priority: form description > parsed description > parsed title
    const finalDescription = description?.trim() || parsedDescription || imageTitle;

    const { data: imageData, error: dbError } = await supabase
      .from("images")
      .insert({
        url: uploadResult.url,
        storage_path: storagePath,
        description: finalDescription,
        alt_text: imageTitle,
        category: finalImageCategory,
        file_type: file.type,
        file_size_bytes: fileBuffer.length, // Use actual buffer size
        width: dimensions.width,
        height: dimensions.height,
        source_ref: finalSourceRef?.trim() || null,
        created_by: userId,
        pathology_category_id: pathologyCategoryId || null,
        magnification: magnification || null,
      })
      .select()
      .single();

    if (dbError) {
      log.error("Database insert failed:", dbError);

      // CRITICAL: Clean up R2 storage on database error to prevent orphaned files
      try {
        log.debug("Cleaning up R2 file after database error:", storagePath);
        await deleteFromR2(storagePath);
        log.debug("R2 cleanup successful");
      } catch (cleanupError) {
        log.error("CRITICAL: Failed to cleanup R2 file after database error:", cleanupError);
        log.error("Orphaned file at:", storagePath);
      }

      uploadedStoragePath = null; // Reset since we cleaned up

      return NextResponse.json(
        { error: `Failed to save image metadata: ${dbError.message || "Unknown database error"}` },
        { status: 500 }
      );
    }

    // Success! Clear the tracking variable
    uploadedStoragePath = null;

    // Revalidate caches to update all admin pages
    revalidateImages({ imageId: imageData.id, includeDashboard: true });

    return NextResponse.json({
      success: true,
      image: imageData,
      uploadResult: {
        url: uploadResult.url,
        key: uploadResult.key,
        size: uploadResult.size,
        contentType: uploadResult.contentType,
      },
    });
  } catch (error) {
    log.error("Image upload error:", error);

    // If we have an uploaded file that wasn't saved to database, clean it up
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

    // Provide user-friendly error message
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Upload failed: ${errorMessage}. Please try again.` },
      { status: 500 }
    );
  }
}
