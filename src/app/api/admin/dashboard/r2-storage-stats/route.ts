import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCachedStorageMetrics } from "@/shared/services/r2-storage-metrics";
import { formatSize } from "@/features/admin/images/services/image-upload";

/**
 * @swagger
 * /api/admin/dashboard/r2-storage-stats:
 *   get:
 *     summary: Get R2 storage statistics
 *     description: Retrieve detailed statistics about Cloudflare R2 storage usage across all buckets, including total usage, available space, and per-bucket breakdowns.
 *     tags:
 *       - Admin - Dashboard
 *     responses:
 *       200:
 *         description: Successfully retrieved R2 storage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalR2LimitBytes:
 *                       type: integer
 *                       description: Total R2 storage limit in bytes (10 GB)
 *                       example: 10737418240
 *                     totalUsedBytes:
 *                       type: integer
 *                       description: Total storage used across all buckets in bytes
 *                     availableBytes:
 *                       type: integer
 *                       description: Available storage space in bytes
 *                     formattedTotalUsed:
 *                       type: string
 *                       description: Human-readable total storage used
 *                       example: 2.5 GB
 *                     formattedAvailable:
 *                       type: string
 *                       description: Human-readable available storage
 *                       example: 7.5 GB
 *                     buckets:
 *                       type: object
 *                       properties:
 *                         images:
 *                           type: object
 *                           properties:
 *                             totalSize:
 *                               type: integer
 *                               description: Total size of images bucket in bytes
 *                             objectCount:
 *                               type: integer
 *                               description: Number of objects in images bucket
 *                             formattedSize:
 *                               type: string
 *                               description: Human-readable size of images bucket
 *                               example: 1.2 GB
 *                         data:
 *                           type: object
 *                           properties:
 *                             totalSize:
 *                               type: integer
 *                               description: Total size of data bucket in bytes
 *                             objectCount:
 *                               type: integer
 *                               description: Number of objects in data bucket
 *                             formattedSize:
 *                               type: string
 *                               description: Human-readable size of data bucket
 *                               example: 1.3 GB
 *       500:
 *         description: Internal server error - failed to fetch R2 statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Failed to fetch R2 storage statistics
 *                 details:
 *                   type: string
 *                   description: Detailed error message
 */
export async function GET() {
  try {
    // Create service role client to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get cached metrics from database (FAST - <100ms vs 10+ seconds)
    const cachedMetrics = await getCachedStorageMetrics(undefined, supabaseAdmin);

    // Find metrics for each bucket
    const imagesBucket = cachedMetrics.find(
      (m) => m.bucketName === "pathology-bites-images"
    ) || { totalSize: 0, objectCount: 0 };

    const dataBucket = cachedMetrics.find(
      (m) => m.bucketName === "pathology-bites-data"
    ) || { totalSize: 0, objectCount: 0 };

    const totalUsedBytes = imagesBucket.totalSize + dataBucket.totalSize;
    const totalR2LimitBytes = 10737418240; // 10GB in bytes
    const availableBytes = Math.max(0, totalR2LimitBytes - totalUsedBytes);

    return NextResponse.json({
      success: true,
      data: {
        totalR2LimitBytes,
        totalUsedBytes,
        availableBytes,
        formattedTotalUsed: formatSize(totalUsedBytes),
        formattedAvailable: formatSize(availableBytes),
        buckets: {
          images: {
            totalSize: imagesBucket.totalSize,
            objectCount: imagesBucket.objectCount,
            formattedSize: formatSize(imagesBucket.totalSize),
          },
          data: {
            totalSize: dataBucket.totalSize,
            objectCount: dataBucket.objectCount,
            formattedSize: formatSize(dataBucket.totalSize),
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to get R2 storage stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch R2 storage statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
