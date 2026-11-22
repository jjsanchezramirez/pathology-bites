"use client";

import { useMemo } from "react";
import { StatCard, StatCardSkeleton, StatGrid } from "@/shared/components/ui/page-layout";
import { Tag, TagIcon, AlertCircle, TrendingUp } from "lucide-react";

interface TagStatsCardsProps {
  tags: Array<{
    id: string;
    name: string;
    question_count?: number;
  }>;
  totalTags: number;
  loading?: boolean;
}

export function TagStatsCards({ tags, totalTags, loading = false }: TagStatsCardsProps) {
  const stats = useMemo(() => {
    const unusedCount = tags.filter((tag) => (tag.question_count || 0) === 0).length;
    const usedCount = totalTags - unusedCount;

    // Find most used tag
    const mostUsedTag = tags.reduce(
      (max, tag) => ((tag.question_count || 0) > (max.question_count || 0) ? tag : max),
      tags[0] || { name: "N/A", question_count: 0 }
    );

    // Calculate average usage
    const totalQuestions = tags.reduce((sum, tag) => sum + (tag.question_count || 0), 0);
    const avgUsage = usedCount > 0 ? (totalQuestions / usedCount).toFixed(1) : "0";

    return {
      total: totalTags,
      used: usedCount,
      unused: unusedCount,
      unusedPercentage: totalTags > 0 ? ((unusedCount / totalTags) * 100).toFixed(1) : "0",
      mostUsed: mostUsedTag,
      avgUsage,
    };
  }, [tags, totalTags]);

  if (loading) {
    return (
      <StatGrid>
        {Array.from({ length: 4 }).map((_, idx) => (
          <StatCardSkeleton key={idx} />
        ))}
      </StatGrid>
    );
  }

  return (
    <StatGrid>
      <StatCard
        label="Total Tags"
        value={stats.total}
        icon={Tag}
        hint={`${stats.used} used, ${stats.unused} unused`}
      />
      <StatCard
        label="Unused Tags"
        value={stats.unused}
        icon={AlertCircle}
        tone="warning"
        hint={`${stats.unusedPercentage}% of all tags`}
      />
      <StatCard
        label="Most Used Tag"
        value={
          <span className="block truncate" title={stats.mostUsed.name}>
            {stats.mostUsed.name}
          </span>
        }
        icon={TrendingUp}
        tone="success"
        hint={`${stats.mostUsed.question_count || 0} questions`}
      />
      <StatCard
        label="Average Usage"
        value={stats.avgUsage}
        icon={TagIcon}
        tone="info"
        hint="Questions per used tag"
      />
    </StatGrid>
  );
}
