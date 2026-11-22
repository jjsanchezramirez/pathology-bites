// src/shared/components/layout/dashboard/system-status.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, Gauge, Server, Timer } from "lucide-react";
import {
  PageSection,
  SectionCard,
  StatCard,
  StatGrid,
  StatTone,
} from "@/shared/components/ui/page-layout";
import { createClient } from "@/shared/services/client";
import { log } from "@/shared/utils/logging";

interface SystemMetrics {
  vercelStatus: "operational" | "error";
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
  const [metrics, setMetrics] = useState<SystemMetrics>({
    vercelStatus: "operational",
    supabaseStatus: "operational",
    cloudflareR2Status: "operational",
    responseTime: 0,
    dbQueryTime: 0,
    dbConnections: 0,
    activeUsers: 0,
    activeUsersWeekly: 0,
    activeUsersMonthly: 0,
    storageUsage: 0,
    r2StorageUsage: 0,
    r2StorageFormatted: "0 MB",
    lastUpdated: new Date(),
  });

  const supabase = createClient();

  const checkSystemHealth = useCallback(async () => {
    try {
      // Use the API endpoint for consistency
      const response = await fetch("/api/admin/system-status");

      if (response.ok) {
        const data = await response.json();

        setMetrics({
          vercelStatus: data.vercelStatus,
          supabaseStatus: data.supabaseStatus,
          cloudflareR2Status: data.cloudflareR2Status || "operational",
          responseTime: data.responseTime,
          dbQueryTime: data.dbQueryTime || 0,
          dbConnections: data.dbConnections || 0,
          activeUsers: data.activeUsers || 0,
          activeUsersWeekly: data.activeUsersWeekly || 0,
          activeUsersMonthly: data.activeUsersMonthly || 0,
          storageUsage: data.storageUsage || 0,
          r2StorageUsage: data.r2StorageUsage || 0,
          r2StorageFormatted: data.r2StorageFormatted || "0 MB",
          lastUpdated: new Date(data.lastUpdated),
        });
      } else {
        log.warn(`System status API returned ${response.status}, falling back to direct check`);

        // If API fails, fall back to direct check
        const startTime = performance.now();
        const { error } = await supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .limit(1);

        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);

        setMetrics({
          vercelStatus: "operational",
          supabaseStatus: error ? "error" : "operational",
          cloudflareR2Status: "operational", // Default when API fails
          responseTime,
          dbQueryTime: 0,
          dbConnections: 0,
          activeUsers: 0,
          activeUsersWeekly: 0,
          activeUsersMonthly: 0,
          storageUsage: 0,
          r2StorageUsage: 0,
          r2StorageFormatted: "0 MB",
          lastUpdated: new Date(),
        });
      }
    } catch (error) {
      log.error("System health check failed:", error);

      // Detect network errors (laptop sleep/wake, offline, etc.)
      const isNetworkError =
        error instanceof TypeError &&
        (error.message?.includes("fetch") || error.message?.includes("network"));

      if (isNetworkError) {
        log.warn("Network connection interrupted during system health check");
      }

      // Set error state but don't show toast (this is background polling)
      setMetrics({
        vercelStatus: "operational",
        supabaseStatus: "error",
        cloudflareR2Status: "error",
        responseTime: 0,
        dbQueryTime: 0,
        dbConnections: 0,
        activeUsers: 0,
        activeUsersWeekly: 0,
        activeUsersMonthly: 0,
        storageUsage: 0,
        r2StorageUsage: 0,
        r2StorageFormatted: "0 MB",
        lastUpdated: new Date(),
      });
    }
  }, [supabase]);

  useEffect(() => {
    checkSystemHealth();

    // Optimized: Check every 2 minutes instead of 30 seconds
    // This reduces database load significantly
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

  return (
    <PageSection
      title="System Health & Monitoring"
      description={
        <span className="text-xs">Last updated: {metrics.lastUpdated.toLocaleTimeString()}</span>
      }
    >
      {/* Service Status Grid */}
      <StatGrid>
        <StatCard
          label="Vercel"
          value={metrics.vercelStatus === "operational" ? "Operational" : "Error"}
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
            { label: "DB Connections", value: 1 },
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
