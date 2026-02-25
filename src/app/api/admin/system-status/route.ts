// src/app/api/admin/system-status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCachedStorageMetrics } from "@/shared/services/r2-storage-metrics";
import { formatSize } from "@/features/admin/images/services/image-upload";
import { devLog } from "@/shared/utils/logging/dev-logger";

interface SystemHealth {
  vercelStatus: "operational" | "error";
  supabaseStatus: "operational" | "error";
  cloudflareR2Status: "operational" | "error";
  responseTime: number;
  dbQueryTime: number; // Average database query time in ms
  dbConnections: number;
  activeUsers: number; // Currently active users (logged in within last 24 hours)
  activeUsersWeekly: number; // Active users in last 7 days
  activeUsersMonthly: number; // Active users in last 30 days
  storageUsage: number; // Supabase storage in MB
  r2StorageUsage: number; // R2 storage in MB
  r2StorageFormatted: string; // Formatted R2 storage
  lastUpdated: string;
}

/**
 * @swagger
 * /api/admin/system-status:
 *   get:
 *     summary: Get comprehensive system health status
 *     description: Retrieve detailed system health information including service statuses (Vercel, Supabase, Cloudflare R2), performance metrics, active user counts, and storage usage. Requires admin role.
 *     tags:
 *       - Admin - System
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved system health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vercelStatus:
 *                   type: string
 *                   enum: [operational, error]
 *                   description: Vercel platform status
 *                 supabaseStatus:
 *                   type: string
 *                   enum: [operational, error]
 *                   description: Supabase database status
 *                 cloudflareR2Status:
 *                   type: string
 *                   enum: [operational, error]
 *                   description: Cloudflare R2 storage status
 *                 responseTime:
 *                   type: integer
 *                   description: Total API response time in milliseconds
 *                 dbQueryTime:
 *                   type: integer
 *                   description: Average database query time in milliseconds
 *                 dbConnections:
 *                   type: integer
 *                   description: Number of active database connections
 *                 activeUsers:
 *                   type: integer
 *                   description: Users active in the last 24 hours (by last sign-in)
 *                 activeUsersWeekly:
 *                   type: integer
 *                   description: Users active in the last 7 days (by last sign-in)
 *                 activeUsersMonthly:
 *                   type: integer
 *                   description: Users active in the last 30 days (by last sign-in)
 *                 storageUsage:
 *                   type: integer
 *                   description: Supabase storage usage in MB
 *                 r2StorageUsage:
 *                   type: integer
 *                   description: Cloudflare R2 storage usage in MB
 *                 r2StorageFormatted:
 *                   type: string
 *                   description: Human-readable formatted R2 storage usage
 *                   example: 2.5 GB
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp of when the status was retrieved
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - admin access required
 */
export async function GET(request: Request) {
  const startTime = performance.now();

  try {
    // Auth check - require admin role only
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId || userRole !== "admin") {
      return NextResponse.json(
        { error: userRole ? "Forbidden - Admin access required" : "Unauthorized" },
        { status: userRole ? 403 : 401 }
      );
    }

    devLog.info("System status check started");

    const supabase = await createClient();

    // Create a service role client for admin operations
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    devLog.debug("Supabase clients created");

    // Measure database query time separately
    const dbStartTime = performance.now();
    const dbTestPromise = supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .limit(1);
    const dbTestResult = await dbTestPromise;
    const dbEndTime = performance.now();
    const dbQueryTime = Math.round(dbEndTime - dbStartTime);

    devLog.database({
      query: "SELECT id FROM users LIMIT 1",
      duration: dbQueryTime,
      rows: 1,
      error: dbTestResult.error?.message,
    });

    // Test other services and get metrics in parallel

    devLog.debug("Fetching system metrics in parallel");
    const parallelStart = performance.now();

    // Calculate time thresholds for active user queries
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      storageStats,
      vercelStatusResponse,
      r2StorageMetrics,
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
    ] = await Promise.allSettled([
      supabase.from("v_storage_stats").select("*").single(),
      fetch("https://www.vercel-status.com/api/v2/status.json"),
      getCachedStorageMetrics(undefined, supabaseAdmin), // Use service role to bypass RLS
      // Count active users based on registration date (users who joined recently)
      // This better represents user growth than quiz activity alone
      supabase.rpc("count_active_users_since", { since_date: twentyFourHoursAgo }),
      supabase.rpc("count_active_users_since", { since_date: sevenDaysAgo }),
      supabase.rpc("count_active_users_since", { since_date: thirtyDaysAgo }),
    ]);

    const parallelDuration = Math.round(performance.now() - parallelStart);
    devLog.performance("Parallel system checks", parallelDuration, {
      storageStats: storageStats.status,
      vercelStatus: vercelStatusResponse.status,
      r2StorageMetrics: r2StorageMetrics.status,
      dailyActiveUsers: dailyActiveUsers.status,
      weeklyActiveUsers: weeklyActiveUsers.status,
      monthlyActiveUsers: monthlyActiveUsers.status,
    });

    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    // Check Vercel status
    let vercelStatus: "operational" | "error" = "operational";
    if (vercelStatusResponse.status === "fulfilled") {
      try {
        const vercelResponse = vercelStatusResponse.value as Response;
        if (vercelResponse.ok) {
          const vercelData = await vercelResponse.json();
          // Vercel API returns status: { indicator: 'none' | 'minor' | 'major' | 'critical' }
          const indicator = vercelData?.status?.indicator;
          vercelStatus = indicator === "none" ? "operational" : "error";
        } else {
          vercelStatus = "error";
        }
      } catch (error) {
        console.error("Failed to check Vercel status:", error);
        vercelStatus = "error";
      }
    } else {
      vercelStatus = "error";
    }

    // Check Supabase storage
    let storageUsage = 0; // Supabase storage
    if (storageStats.status === "fulfilled" && storageStats.value.data) {
      storageUsage = storageStats.value.data.total_size_mb || 0;
    }

    // Check Cloudflare R2 status and get cached usage metrics
    let cloudflareR2Status: "operational" | "error" = "operational";
    let r2StorageUsage = 0; // R2 storage in MB
    let r2StorageFormatted = "0 MB";

    if (r2StorageMetrics.status === "fulfilled") {
      try {
        const metrics = r2StorageMetrics.value;
        const totalUsedBytes = metrics.reduce((sum, m) => sum + m.totalSize, 0);
        r2StorageUsage = Math.round(totalUsedBytes / (1024 * 1024)); // Convert to MB
        r2StorageFormatted = formatSize(totalUsedBytes);
      } catch (error) {
        console.error("Failed to calculate R2 stats from cached metrics:", error);
        cloudflareR2Status = "error";
      }
    } else {
      console.error("Failed to fetch R2 storage metrics:", r2StorageMetrics.reason);
      cloudflareR2Status = "error";
    }

    // Extract active user counts from RPC function results
    let activeUsers = 0;
    let activeUsersWeekly = 0;
    let activeUsersMonthly = 0;

    if (dailyActiveUsers.status === "fulfilled" && dailyActiveUsers.value.data !== null) {
      activeUsers = Number(dailyActiveUsers.value.data) || 0;
    } else if (dailyActiveUsers.status === "rejected") {
      console.error("[System Status] Daily active users query failed:", dailyActiveUsers.reason);
      console.warn("[System Status] Is count_active_users_since() function created in database?");
    }

    if (weeklyActiveUsers.status === "fulfilled" && weeklyActiveUsers.value.data !== null) {
      activeUsersWeekly = Number(weeklyActiveUsers.value.data) || 0;
    } else if (weeklyActiveUsers.status === "rejected") {
      console.error("[System Status] Weekly active users query failed:", weeklyActiveUsers.reason);
    }

    if (monthlyActiveUsers.status === "fulfilled" && monthlyActiveUsers.value.data !== null) {
      activeUsersMonthly = Number(monthlyActiveUsers.value.data) || 0;
    } else if (monthlyActiveUsers.status === "rejected") {
      console.error(
        "[System Status] Monthly active users query failed:",
        monthlyActiveUsers.reason
      );
    }

    const systemHealth: SystemHealth = {
      vercelStatus,
      supabaseStatus: dbTestResult.error ? "error" : "operational",
      cloudflareR2Status,
      responseTime,
      dbQueryTime,
      dbConnections: 1, // Hardcoded as requested
      activeUsers,
      activeUsersWeekly,
      activeUsersMonthly,
      storageUsage, // Supabase storage
      r2StorageUsage, // R2 storage
      r2StorageFormatted, // Formatted R2 storage
      lastUpdated: new Date().toISOString(),
    };

    // Log system health metrics
    devLog.info("System status check completed", {
      responseTime,
      dbQueryTime,
      activeUsers,
      activeUsersWeekly,
      activeUsersMonthly,
      r2StorageFormatted,
      allServicesOperational:
        vercelStatus === "operational" &&
        systemHealth.supabaseStatus === "operational" &&
        cloudflareR2Status === "operational",
    });

    // Only log errors, not successful checks
    if (dbTestResult.error) {
      devLog.error("Supabase connection error", dbTestResult.error);
    }

    return NextResponse.json(systemHealth, { status: 200 });
  } catch (error) {
    devLog.error("System status check failed", error);

    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    const errorResponse: SystemHealth = {
      vercelStatus: "operational", // We're still running
      supabaseStatus: "error",
      cloudflareR2Status: "error",
      responseTime,
      dbQueryTime: 0,
      dbConnections: 0,
      activeUsers: 0,
      activeUsersWeekly: 0,
      activeUsersMonthly: 0,
      storageUsage: 0,
      r2StorageUsage: 0,
      r2StorageFormatted: "0 MB",
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 200 });
  }
}
