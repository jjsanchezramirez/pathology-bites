"use client";

import { Card } from "@/shared/components/ui/card";
import type { ABPathStats } from "./abpath-utils";

export function ABPathStatsCard({ stats }: { stats: ABPathStats }) {
  return (
    <Card className="p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-slate-700">{stats.totalVisible}</div>
          <div className="text-xs text-gray-500">Selected Items</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-700">{stats.totalAll}</div>
          <div className="text-xs text-gray-500">Total Items</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-600">{stats.cCount}</div>
          <div className="text-xs text-gray-500">Core (C)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-600">{stats.arCount}</div>
          <div className="text-xs text-gray-500">Advanced (AR)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-600">{stats.fCount}</div>
          <div className="text-xs text-gray-500">Fellow (F)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-700">{stats.totalPercentage}%</div>
          <div className="text-xs text-gray-500">Coverage</div>
        </div>
      </div>
    </Card>
  );
}
