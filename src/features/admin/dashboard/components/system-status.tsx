// src/shared/components/layout/dashboard/system-status.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, Gauge, Server, Timer } from "lucide-react";
import {
  PageSection,
  SectionCard,
  StatCard,
  StatCardSkeleton,
  StatGrid,
  StatTone,
} from "@/shared/components/ui/page-layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { log } from "@/shared/utils/logging";

interface SystemMetrics {
  vercelStatus: "operational" | "error" | "unknown";
  supabaseStatus: "operational" | "error";
  cloudflareR2Status: "operational" | "error";
  responseTime: number;
  dbQueryTime: number;
  dbConnections: number;
  activeUsers: number;
  activeUsersWeekly: number;
  activeUsersMonthly: number;
  storageUsage: number; // Supabase storage in MB
  r2StorageUsage: number; // R2 storage in MB
  r2StorageFormatted: string; // Formatted R2 storage
  lastUpdated: Date;
}

export function SystemStatus() {
  // null until the first successful check: the panel shows a skeleton, never placeholder
  // zeros or an unchecked "Operational".
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  // Set when the latest check failed; earlier metrics (if any) stay on screen, marked stale.
  const [failedAt, setFailedAt] = useState<Date | null>(null);

  const checkSystemHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/system-status");
      if (!response.ok) throw new Error(`System status API returned ${response.status}`);
      const data = await response.json();

      setMetrics({
        vercelStatus: data.vercelStatus,
        supabaseStatus: data.supabaseStatus,
        cloudflareR2Status: data.cloudflareR2Status || "operational",
        responseTime: data.responseTime,
        dbQueryTime: data.dbQueryTime ?? 0,
        dbConnections: data.dbConnections ?? 0,
        activeUsers: data.activeUsers ?? 0,
        activeUsersWeekly: data.activeUsersWeekly ?? 0,
        activeUsersMonthly: data.activeUsersMonthly ?? 0,
        storageUsage: data.storageUsage ?? 0,
        r2StorageUsage: data.r2StorageUsage ?? 0,
        r2StorageFormatted: data.r2StorageFormatted || "0 MB",
        lastUpdated: new Date(data.lastUpdated),
      });
      setFailedAt(null);
    } catch (error) {
      // Background polling: log, keep whatever we last showed, and say it's stale.
      log.warn("System health check failed:", error);
      setFailedAt(new Date());
    }
  }, []);

  useEffect(() => {
    checkSystemHealth();
    // Every 2 minutes; the route runs several queries plus an external status fetch.
    const interval = setInterval(checkSystemHealth, 120000);
    return () => clearInterval(interval);
  }, [checkSystemHealth]);

  const getStatusTone = (status: string): StatTone => {
    switch (status) {
      case "operational":
        return "success";
      case "error":
        return "danger";
      default:
        return "default";
    }
  };

  const getLatencyTone = (ms: number, warnAt: number, errorAt: number): StatTone =>
    ms > errorAt ? "danger" : ms > warnAt ? "warning" : "success";

  const description = metrics ? (
    <span className="text-xs">
      Last updated: {metrics.lastUpdated.toLocaleTimeString()}
      {failedAt && (
        <span className="text-destructive">
          {" "}
          · latest check failed at {failedAt.toLocaleTimeString()}, showing older data
        </span>
      )}
    </span>
  ) : failedAt ? (
    <span className="text-xs text-destructive">
      Couldn&apos;t load system status ({failedAt.toLocaleTimeString()}). Retrying every 2 minutes.
    </span>
  ) : (
    <span className="text-xs">Checking services…</span>
  );

  if (!metrics) {
    return (
      <PageSection title="System Health & Monitoring" description={description}>
        {!failedAt && (
          <>
            <StatGrid>
              {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </StatGrid>
            <SectionCard title="System Metrics">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </SectionCard>
          </>
        )}
      </PageSection>
    );
  }

  return (
    <PageSection title="System Health & Monitoring" description={description}>
      {/* Service Status Grid */}
      <StatGrid>
        <StatCard
          label="Vercel"
          value={
            metrics.vercelStatus === "operational"
              ? "Operational"
              : metrics.vercelStatus === "unknown"
                ? "Unknown"
                : "Error"
          }
          hint="Hosting"
          icon={Server}
          tone={getStatusTone(metrics.vercelStatus)}
        />
        <StatCard
          label="Supabase"
          value={metrics.supabaseStatus === "operational" ? "Operational" : "Error"}
          hint="Database"
          icon={Database}
          tone={getStatusTone(metrics.supabaseStatus)}
        />
        <StatCard
          label="API Response"
          value={`${metrics.responseTime}ms`}
          hint="Total Time"
          icon={Gauge}
          tone={getLatencyTone(metrics.responseTime, 300, 1000)}
        />
        <StatCard
          label="DB Query"
          value={`${metrics.dbQueryTime}ms`}
          hint="Query Time"
          icon={Timer}
          tone={getLatencyTone(metrics.dbQueryTime, 100, 500)}
        />
      </StatGrid>

      {/* System Metrics */}
      <SectionCard title="System Metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "DB Connections", value: metrics.dbConnections },
            { label: "Daily Active", value: metrics.activeUsers },
            { label: "Weekly Active", value: metrics.activeUsersWeekly },
            { label: "Monthly Active", value: metrics.activeUsersMonthly },
            { label: "Cloudflare R2", value: metrics.r2StorageFormatted },
            { label: "Supabase Storage", value: `${(metrics.storageUsage / 1024).toFixed(1)}GB` },
          ].map((item) => (
            <div key={item.label} className="min-w-0 text-center">
              <p className="truncate text-2xl font-bold tabular-nums">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </PageSection>
  );
}
