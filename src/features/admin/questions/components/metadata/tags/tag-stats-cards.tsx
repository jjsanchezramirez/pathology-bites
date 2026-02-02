"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Tags Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tags</CardTitle>
          <Tag className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            {stats.used} used, {stats.unused} unused
          </p>
        </CardContent>
      </Card>

      {/* Unused Tags Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unused Tags</CardTitle>
          <AlertCircle className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{stats.unused}</div>
          <p className="text-xs text-muted-foreground">{stats.unusedPercentage}% of all tags</p>
        </CardContent>
      </Card>

      {/* Most Used Tag Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Most Used Tag</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold text-green-600 truncate" title={stats.mostUsed.name}>
            {stats.mostUsed.name}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.mostUsed.question_count || 0} questions
          </p>
        </CardContent>
      </Card>

      {/* Average Usage Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Usage</CardTitle>
          <TagIcon className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{stats.avgUsage}</div>
          <p className="text-xs text-muted-foreground">Questions per used tag</p>
        </CardContent>
      </Card>
    </div>
  );
}
