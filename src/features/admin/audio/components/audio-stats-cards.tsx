"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Music, Download } from "lucide-react";
import { formatBytes } from "@/shared/utils/format";
import { getAudioStats } from "@/features/admin/audio/services/audio";
import { log } from "@/shared/utils/logging";

interface AudioStats {
  total: number;
  totalSizeBytes: number;
}

export function AudioStatsCards({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<AudioStats | null>(null);

  useEffect(() => {
    getAudioStats()
      .then(setStats)
      .catch((error) => log.error("Error loading stats:", error));
  }, [refreshKey]);

  if (!stats) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Audio Files</CardTitle>
          <Music className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            {formatBytes(stats.totalSizeBytes)} total size
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
          <Download className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatBytes(stats.totalSizeBytes)}</div>
          <p className="text-xs text-muted-foreground">Audio storage</p>
        </CardContent>
      </Card>
    </div>
  );
}
