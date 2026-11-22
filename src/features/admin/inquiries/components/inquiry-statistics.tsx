// src/features/inquiries/components/inquiry-statistics.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/shared/services/client";
import { StatCard, StatCardSkeleton, StatGrid } from "@/shared/components/ui/page-layout";
import { MessageSquare, CheckCircle, Clock, HelpCircle } from "lucide-react";
import { toast } from "@/shared/utils/ui/toast";
import { INQUIRY_TYPES } from "../types/inquiries";
import { log } from "@/shared/utils/logging";

interface InquiryStats {
  totalInquiries: number;
  pendingGeneral: number;
  pendingTech: number;
  resolvedInquiries: number;
}

interface InquiryStatisticsProps {
  onStatsChange?: () => void;
  refreshTrigger?: number;
}

export function InquiryStatistics({ onStatsChange, refreshTrigger }: InquiryStatisticsProps) {
  const [stats, setStats] = useState<InquiryStats>({
    totalInquiries: 0,
    pendingGeneral: 0,
    pendingTech: 0,
    resolvedInquiries: 0,
  });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Get all inquiries with their status and type
      const { data: inquiries, error } = await supabase
        .from("inquiries")
        .select("request_type, status");

      if (error) {
        log.error("Error fetching inquiry statistics:", error);
        toast.error("Failed to load inquiry statistics");
        return;
      }

      const inquiriesData = inquiries || [];

      // Calculate statistics
      const totalInquiries = inquiriesData.length;
      const pendingGeneral = inquiriesData.filter(
        (inquiry) => inquiry.request_type === "general" && inquiry.status === "pending"
      ).length;
      const pendingTech = inquiriesData.filter(
        (inquiry) => inquiry.request_type === INQUIRY_TYPES.TECH && inquiry.status === "pending"
      ).length;
      const resolvedInquiries = inquiriesData.filter(
        (inquiry) => inquiry.status === "resolved" || inquiry.status === "closed"
      ).length;

      setStats({
        totalInquiries,
        pendingGeneral,
        pendingTech,
        resolvedInquiries,
      });

      onStatsChange?.();
    } catch (error) {
      log.error("Unexpected error fetching inquiry statistics:", error);
      toast.error("An unexpected error occurred while loading statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  if (loading) {
    return (
      <StatGrid>
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </StatGrid>
    );
  }

  return (
    <StatGrid>
      <StatCard label="Total Inquiries" value={stats.totalInquiries} icon={MessageSquare} />
      <StatCard label="Pending General" value={stats.pendingGeneral} icon={Clock} />
      <StatCard label="Pending Tech" value={stats.pendingTech} icon={HelpCircle} />
      <StatCard label="Resolved" value={stats.resolvedInquiries} icon={CheckCircle} />
    </StatGrid>
  );
}
