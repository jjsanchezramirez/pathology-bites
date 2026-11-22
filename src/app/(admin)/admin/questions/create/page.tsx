import { Metadata } from "next";
import { CreateQuestionClient } from "./create-question-client";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer } from "@/shared/components/ui/page-layout";
import { RequirePermission } from "@/shared/components/auth/role-guard";
import { PageErrorBoundary } from "@/shared/components/common";

export const metadata: Metadata = {
  title: "Create Question | Pathology Bites Admin",
  description: "Create questions using multi-step form with AI assistance and JSON import",
};

export default function CreateQuestionPage() {
  return (
    <RequirePermission permission="questions.create">
      <PageErrorBoundary pageName="Create Question" showHomeButton={true} showBackButton={true}>
        <PageContainer>
          <PageHeader
            title="Create Question"
            description="Create multiple-choice questions using multi-step form with AI assistance and JSON import"
          />

          <CreateQuestionClient />
        </PageContainer>
      </PageErrorBoundary>
    </RequirePermission>
  );
}
