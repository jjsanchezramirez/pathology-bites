import { Metadata } from "next";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer } from "@/shared/components/ui/page-layout";
import { RequirePermission } from "@/shared/components/auth/role-guard";
import { PageErrorBoundary } from "@/shared/components/common";
import { EditQuestionClient } from "./edit-question-client";

export const metadata: Metadata = {
  title: "Edit Question | Pathology Bites Admin",
  description: "Edit question details, images, and metadata",
};

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission permission="questions.update">
      <PageErrorBoundary pageName="Edit Question" showHomeButton={true} showBackButton={true}>
        <PageContainer>
          <PageHeader
            title="Edit Question"
            description="Update question content, images, and metadata"
          />

          <EditQuestionClient questionId={id} />
        </PageContainer>
      </PageErrorBoundary>
    </RequirePermission>
  );
}
