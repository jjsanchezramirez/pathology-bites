// src/app/(admin)/admin/questions/metadata/page.tsx
import { Metadata } from "next";
import { QuestionManagementTable } from "@/features/admin/questions/components/shared/question-management-table";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";

export const metadata: Metadata = {
  title: "Question Metadata - Admin Dashboard",
  description: "Manage question tags, categories, and sets",
};

export default function QuestionMetadataPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Question Metadata"
        description="Manage tags, categories, and question sets to organize your question bank"
      />

      <SectionCard
        title="Organization Tools"
        description="Create and manage tags, categories, and question sets to organize your questions effectively"
      >
        <QuestionManagementTable />
      </SectionCard>
    </PageContainer>
  );
}
