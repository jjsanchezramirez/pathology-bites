"use client";

import { useEffect, useState } from "react";
import { StatCard, StatGrid } from "@/shared/components/ui/page-layout";
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
    <StatGrid>
      <StatCard
        label="Total Audio Files"
        value={stats.total}
        icon={Music}
        hint={`${formatBytes(stats.totalSizeBytes)} total size`}
      />
      <StatCard
        label="Storage Used"
        value={formatBytes(stats.totalSizeBytes)}
        icon={Download}
        hint="Audio storage"
      />
    </StatGrid>
  );
}
