'use client'

// Simplified storage statistics cards for image management
import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Loader2, HardDrive, Images, ImageOff, Trash2, Database } from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import { toast } from 'sonner';
import { getStorageStats, StorageStats } from '@/features/images/services/image-analytics';
import { CleanupDialog } from './cleanup-dialog';

export interface StorageStatsRef {
  refresh: () => void;
}

export const StorageStatsCards = forwardRef<StorageStatsRef>((props, ref) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getStorageStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
      toast.error('Failed to load storage statistics');
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
    refresh: loadStats
  }));

  // Calculate storage usage percentage (1GB = 1,073,741,824 bytes)
  const maxStorageBytes = 1073741824; // 1GB in bytes
  const usagePercentage = stats ? Math.round((stats.total_size_bytes / maxStorageBytes) * 100) : 0;
  const formattedMaxStorage = "1.00 GB";

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
              of {formattedMaxStorage} ({usagePercentage}%)
            </p>
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
                  Delete {stats.orphaned_count} Unused Images
                </>
              ) : (
                "No Cleanup Needed"
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
});
