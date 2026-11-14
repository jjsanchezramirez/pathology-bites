"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Trophy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/utils";
import { getGuestId } from "@/shared/leaderboard/guest";

export interface LeaderboardRow {
  rank: number;
  display_name: string;
  score: number;
  duration_ms: number | null;
  meta: Record<string, unknown>;
  isYou: boolean;
}

type Period = "weekly" | "all";

/** Generic leaderboard for any activity registered in shared/leaderboard/activities. */
export function Leaderboard({
  activity,
  refreshKey = 0,
  renderDetail,
}: {
  activity: string;
  /** Bump to refetch (e.g. after submitting a score). */
  refreshKey?: number;
  /** Optional per-row secondary text (e.g. "8/10 · 42s"). */
  renderDetail?: (row: LeaderboardRow) => ReactNode;
}) {
  const [period, setPeriod] = useState<Period>("weekly");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setFailed(false);
    fetch(`/api/public/leaderboard/${activity}?period=${period}&guestId=${getGuestId()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setRows(d.rows))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [activity, period, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-amber-500" />
          Leaderboard
        </h2>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="h-8">
            <TabsTrigger value="weekly" className="px-3 text-xs">
              This week
            </TabsTrigger>
            <TabsTrigger value="all" className="px-3 text-xs">
              All time
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {failed ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Couldn&apos;t load the leaderboard. Try again in a moment.
        </p>
      ) : rows === null ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No scores {period === "weekly" ? "this week" : "yet"}. Be the first on the board.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.rank}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                row.isYou ? "border-primary/40 bg-primary/5" : "border-transparent bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "w-6 text-center font-semibold tabular-nums",
                  row.rank === 1 && "text-amber-500",
                  row.rank === 2 && "text-slate-400",
                  row.rank === 3 && "text-orange-500",
                  row.rank > 3 && "text-muted-foreground"
                )}
              >
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {row.display_name}
                {row.isYou && <span className="ml-1.5 text-xs text-primary">you</span>}
              </span>
              {renderDetail && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {renderDetail(row)}
                </span>
              )}
              <span className="w-14 text-right font-semibold tabular-nums">{row.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
