// src/app/(admin)/admin/settings/page.tsx
import { Metadata } from "next";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer } from "@/shared/components/ui/page-layout";
import { SettingsForm } from "@/features/admin/settings/components/settings-form";

export const metadata: Metadata = {
  title: "Settings - Admin Dashboard",
  description: "Configure system settings and preferences",
};

export default function SettingsPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Settings"
        description="Configure system settings and preferences for the platform."
      />
      <SettingsForm />
    </PageContainer>
  );
}
