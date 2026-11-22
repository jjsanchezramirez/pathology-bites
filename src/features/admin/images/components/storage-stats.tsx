"use client";

// Simplified storage statistics cards for image management
import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  SectionCard,
  StatCard,
  StatCardSkeleton,
  StatGrid,
} from "@/shared/components/ui/page-layout";
import { Images, ImageOff, Trash2, Database } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/utils/ui/toast";
import { getStorageStats, StorageStats } from "@/features/admin/images/services/image-analytics";

import { CleanupDialog } from "./cleanup-dialog";
import { log } from "@/shared/utils/logging";

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
          log.error("Failed to load image stats:", imageStatsResult.reason);
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
              log.warn("R2 stats API returned error:", r2Data.error);
            }
          } else {
            log.warn("Failed to fetch R2 stats:", r2StatsResponse.status);
          }
        } else {
          // R2 stats failed - not critical, just log it
          log.warn("R2 stats request failed:", r2StatsResult.reason);
          // Don't show toast for R2 stats failure - we have fallback values
        }
      } catch (error) {
        log.error("Failed to load storage stats:", error);
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
        <StatGrid>
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </StatGrid>
      );
    }

    if (!stats) {
      return (
        <SectionCard>
          <p className="text-sm text-muted-foreground">Failed to load storage statistics</p>
        </SectionCard>
      );
    }

    return (
      <>
        <StatGrid>
          <StatCard
            label="Total Images"
            value={stats.total_images}
            icon={Images}
            hint={`${stats.formatted_total_size} total size`}
          />

          <StatCard
            label="Storage Used"
            value={stats.formatted_total_size}
            icon={Database}
            hint={
              <>
                of {formattedAvailable || "Unknown"} available ({usagePercentage}%)
                {!r2Stats && <span className="ml-1 text-orange-500">*</span>}
              </>
            }
          >
            {!r2Stats && <p className="text-xs text-orange-500">*Using cached values</p>}
          </StatCard>

          <StatCard
            label="Unused Images"
            value={stats.orphaned_count}
            icon={ImageOff}
            tone={stats.orphaned_count > 0 ? "warning" : "default"}
            hint={`${stats.formatted_orphaned_size} not in use`}
          />

          <StatCard
            label="Cleanup"
            icon={Trash2}
            value={
              <Button
                variant={stats.orphaned_count > 0 ? "destructive" : "outline"}
                size="sm"
                onClick={handleCleanupClick}
                disabled={stats.orphaned_count === 0}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {stats.orphaned_count > 0 ? `Clean Up (${stats.orphaned_count})` : "All Clean"}
              </Button>
            }
          />
        </StatGrid>

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
