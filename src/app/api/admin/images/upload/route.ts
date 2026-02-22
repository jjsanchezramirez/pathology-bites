import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { uploadToR2, generateImageStoragePath, deleteFromR2 } from "@/shared/services/r2-storage";
import { getImageDimensionsFromFile } from "@/shared/utils/images/server-image-utils";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";
import { parseImageFilename } from "@/shared/utils/images/filename-parser";
import { revalidateImages } from "@/shared/utils/api/revalidation";

/**
 * @swagger
 * /api/admin/images/upload:
 *   post:
 *     summary: Upload a new image
 *     description: Upload a new image to R2 storage and create a database record. The image is automatically parsed for pathology metadata (category and magnification). Includes validation for file type, size, and dimensions. Requires admin role.
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
 *                 description: The image file to upload (max 10MB, max 10000x10000 pixels)
 *               category:
 *                 type: string
 *                 enum: [microscopic, gross, figure, table]
 *                 description: The image category
 *               description:
 *                 type: string
 *                 description: Optional description for the image (defaults to parsed filename)
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
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required. Please log in to upload images." },
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
      console.error("Failed to read file buffer:", error);
      return NextResponse.json(
        { error: "Failed to read image file. The file may be corrupted." },
        { status: 400 }
      );
    }

    try {
      dimensions = await getImageDimensionsFromFile(file);
    } catch (error) {
      console.error("Failed to get image dimensions:", error);
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

    // Parse filename to extract pathology category and magnification
    const parsedFilename = parseImageFilename(file.name);
    console.log("Parsed filename:", parsedFilename);

    // The parser now returns the category ID directly from static data
    const pathologyCategoryId = parsedFilename.categoryId;
    if (pathologyCategoryId) {
      console.log(`Mapped category "${parsedFilename.categoryName}" to ID: ${pathologyCategoryId}`);
    }

    // Generate R2 storage path
    const storagePath = generateImageStoragePath(file.name, category);
    uploadedStoragePath = storagePath; // Track for cleanup

    // Step 1: Upload to R2
    let uploadResult;
    try {
      uploadResult = await uploadToR2(fileBuffer, storagePath, {
        contentType: file.type,
        cacheControl: "3600",
        metadata: {
          originalName: file.name,
          category,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("R2 upload failed:", error);
      uploadedStoragePath = null; // Reset since upload failed
      return NextResponse.json(
        { error: "Failed to upload image to storage. Please try again." },
        { status: 500 }
      );
    }

    // Step 2: Insert database record with metadata
    // Use parsed title instead of formatImageName
    const imageTitle = parsedFilename.title;
    const { data: imageData, error: dbError } = await supabase
      .from("images")
      .insert({
        url: uploadResult.url,
        storage_path: storagePath,
        description: description?.trim() || imageTitle,
        alt_text: imageTitle,
        category,
        file_type: file.type,
        file_size_bytes: fileBuffer.length, // Use actual buffer size
        width: dimensions.width,
        height: dimensions.height,
        source_ref: sourceRef?.trim() || null,
        created_by: userId,
        pathology_category_id: pathologyCategoryId,
        magnification: parsedFilename.magnification,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert failed:", dbError);

      // CRITICAL: Clean up R2 storage on database error to prevent orphaned files
      try {
        console.log("Cleaning up R2 file after database error:", storagePath);
        await deleteFromR2(storagePath);
        console.log("R2 cleanup successful");
      } catch (cleanupError) {
        console.error("CRITICAL: Failed to cleanup R2 file after database error:", cleanupError);
        console.error("Orphaned file at:", storagePath);
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
    console.error("Image upload error:", error);

    // If we have an uploaded file that wasn't saved to database, clean it up
    if (uploadedStoragePath) {
      try {
        console.log("Cleaning up orphaned R2 file after unexpected error:", uploadedStoragePath);
        await deleteFromR2(uploadedStoragePath);
        console.log("Emergency R2 cleanup successful");
      } catch (cleanupError) {
        console.error("CRITICAL: Failed emergency cleanup of R2 file:", cleanupError);
        console.error("Orphaned file at:", uploadedStoragePath);
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
