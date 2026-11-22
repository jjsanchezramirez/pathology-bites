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
  const { role, isLoading } = useUserRole();
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

  // All admin roles can access the question database
  if (!role || !["admin", "creator", "reviewer"].includes(role)) {
    return <AccessDenied {...AccessDeniedPresets.creatorOrAbove} />;
  }
  // Get role-specific content based on adminMode
  const getPageContent = () => {
    switch (adminMode) {
      case "creator":
        return {
          title: "Question Database (Creator View)",
          description:
            "Browse and search questions in the system. Limited to viewing and basic operations.",
          cardTitle: "All Questions (Read-Only)",
          cardDescription:
            "View questions in the database. Bulk operations are not available in creator view.",
        };
      case "reviewer":
        return {
          title: "Question Database (Reviewer View)",
          description:
            "Browse and search questions for review purposes. Limited to viewing and basic operations.",
          cardTitle: "All Questions (Read-Only)",
          cardDescription:
            "View questions in the database. Bulk operations are not available in reviewer view.",
        };
      default: // admin
        return {
          title: "Question Database",
          description:
            "Browse, search, and manage all questions in the system. Export, edit, and organize questions with advanced filtering and bulk operations.",
          cardTitle: "All Questions",
          cardDescription:
            "Comprehensive view of all questions with advanced search, filtering, and bulk operations. Role-based permissions apply to editing and deletion.",
        };
    }
  };

  const content = getPageContent();

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
