"use client";

// Simplified storage statistics cards for image management
import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Loader2, Images, ImageOff, Trash2, Database } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/utils/ui/toast";
import { getStorageStats, StorageStats } from "@/features/admin/images/services/image-analytics";

import { CleanupDialog } from "./cleanup-dialog";

export interface StorageStatsRef {
  refresh: () => void;
}

interface R2StorageStats {
  totalR2LimitBytes: number;
  totalUsedBytes: number;
  availableBytes: number;
  formattedTotalUsed: string;
  formattedAvailable: string;
}

export const StorageStatsCards = forwardRef<StorageStatsRef>(
  function StorageStatsCards(props, ref) {
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [r2Stats, setR2Stats] = useState<R2StorageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCleanupDialog, setShowCleanupDialog] = useState(false);

    const loadStats = async () => {
      try {
        setLoading(true);

        // Load both image stats and R2 storage stats in parallel
        // Handle errors gracefully for each request
        const [imageStatsResult, r2StatsResult] = await Promise.allSettled([
          getStorageStats(),
          fetch("/api/admin/dashboard/r2-storage-stats"),
        ]);

        // Handle image stats (required)
        if (imageStatsResult.status === "fulfilled") {
          setStats(imageStatsResult.value);
        } else {
          console.error("Failed to load image stats:", imageStatsResult.reason);
          // Check if it's a network error (laptop sleep/wake)
          const isNetworkError =
            imageStatsResult.reason?.message?.includes("fetch") ||
            imageStatsResult.reason?.name === "TypeError";

          if (isNetworkError) {
            toast.error("Network connection interrupted. Please refresh the page.");
          } else {
            toast.error("Failed to load storage statistics");
          }
          return; // Don't continue if image stats fail
        }

        // Handle R2 stats (optional - can fail gracefully)
        if (r2StatsResult.status === "fulfilled") {
          const r2StatsResponse = r2StatsResult.value;
          if (r2StatsResponse.ok) {
            const r2Data = await r2StatsResponse.json();
            if (r2Data.success) {
              setR2Stats(r2Data.data);
            } else {
              console.warn("R2 stats API returned error:", r2Data.error);
            }
          } else {
            console.warn("Failed to fetch R2 stats:", r2StatsResponse.status);
          }
        } else {
          // R2 stats failed - not critical, just log it
          console.warn("R2 stats request failed:", r2StatsResult.reason);
          // Don't show toast for R2 stats failure - we have fallback values
        }
      } catch (error) {
        console.error("Failed to load storage stats:", error);
        const isNetworkError = error instanceof TypeError && error.message.includes("fetch");

        if (isNetworkError) {
          toast.error("Network connection interrupted. Please refresh the page.");
        } else {
          toast.error("Failed to load storage statistics");
        }
      } finally {
        setLoading(false);
      }
    };

    const handleCleanupClick = () => {
      if (!stats || stats.orphaned_count === 0) return;
      setShowCleanupDialog(true);
    };

    const handleCleanupSuccess = () => {
      // Reload stats after successful cleanup
      loadStats();
    };

    useEffect(() => {
      loadStats();
    }, []);

    // Expose refresh function via ref
    useImperativeHandle(ref, () => ({
      refresh: loadStats,
    }));

    // Use dynamic R2 stats if available, otherwise fallback to static values
    const fallbackAvailableBytes = 9847926784; // ~9.15GB fallback
    const availableBytes = r2Stats?.availableBytes ?? fallbackAvailableBytes;

    const formattedAvailable = r2Stats?.formattedAvailable ?? "9.17 GB";
    const usagePercentage =
      stats && availableBytes > 0 ? Math.round((stats.total_size_bytes / availableBytes) * 100) : 0;

    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">Loading data...</p>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!stats) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Failed to load storage statistics</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Images Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Images</CardTitle>
              <Images className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_images}</div>
              <p className="text-xs text-muted-foreground">
                {stats.formatted_total_size} total size
              </p>
            </CardContent>
          </Card>

          {/* Storage Usage Card - moved to position 2 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.formatted_total_size}</div>
              <p className="text-xs text-muted-foreground">
                of {formattedAvailable || "Unknown"} available ({usagePercentage}%)
                {!r2Stats && <span className="text-orange-500 ml-1">*</span>}
              </p>
              {!r2Stats && <p className="text-xs text-orange-500 mt-1">*Using cached values</p>}
            </CardContent>
          </Card>

          {/* Unused Images Card - moved to position 3 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unused Images</CardTitle>
              <ImageOff className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.orphaned_count}</div>
              <p className="text-xs text-muted-foreground">
                {stats.formatted_orphaned_size} not in use
              </p>
            </CardContent>
          </Card>

          {/* Cleanup Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cleanup</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button
                variant={stats.orphaned_count > 0 ? "destructive" : "outline"}
                size="sm"
                onClick={handleCleanupClick}
                disabled={stats.orphaned_count === 0}
                className="w-full"
              >
                {stats.orphaned_count > 0 ? (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clean Up ({stats.orphaned_count})
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    All Clean
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Cleanup Dialog */}
        <CleanupDialog
          open={showCleanupDialog}
          onOpenChange={setShowCleanupDialog}
          orphanedCount={stats.orphaned_count}
          orphanedSize={stats.formatted_orphaned_size}
          onSuccess={handleCleanupSuccess}
        />
      </>
    );
  }
);
