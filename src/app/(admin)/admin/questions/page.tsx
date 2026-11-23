// src/app/(admin)/admin/questions/page.tsx
"use client";

import { useUserRole } from "@/shared/hooks/use-user-role";
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context";
import { QuestionsTable } from "@/features/admin/questions/components/shared/questions-table";
import { QuestionsStatsCards } from "@/features/admin/questions/components/shared/questions-stats-cards";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";
import { Loader2 } from "lucide-react";
import { AccessDenied, AccessDeniedPresets } from "@/shared/components/common/access-denied";

export default function QuestionsPage() {
  const { isAdmin, isStaff, isLoading } = useUserRole();
  const { adminMode } = useDashboardTheme();

  // Show loading while checking role
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Anyone with admin-area access can browse the question database
  if (!isStaff) {
    return <AccessDenied {...AccessDeniedPresets.staff} />;
  }
  // Non-admins browse read-only; bulk operations are admin-only
  const content = isAdmin
    ? {
        title: "Question Database",
        description:
          "Browse, search, and manage all questions in the system. Export, edit, and organize questions with advanced filtering and bulk operations.",
        cardTitle: "All Questions",
        cardDescription:
          "Comprehensive view of all questions with advanced search, filtering, and bulk operations. Permissions apply to editing and deletion.",
      }
    : {
        title: "Question Database",
        description:
          "Browse and search questions in the system. Limited to viewing and basic operations.",
        cardTitle: "All Questions (Read-Only)",
        cardDescription: "View questions in the database. Bulk operations are admin-only.",
      };

  return (
    <PageContainer>
      <PageHeader title={content.title} description={content.description} />

      {/* Statistics Cards */}
      <QuestionsStatsCards />

      <SectionCard title={content.cardTitle} description={content.cardDescription}>
        <QuestionsTable adminMode={adminMode} />
      </SectionCard>
    </PageContainer>
  );
}
