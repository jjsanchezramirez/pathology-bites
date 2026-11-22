// src/app/(admin)/admin/inquiries/page.tsx
"use client";

import { useState } from "react";
import { InquiriesTable } from "@/features/admin/inquiries/components/inquiries-table";
import { InquiryStatistics } from "@/features/admin/inquiries/components/inquiry-statistics";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";

export default function InquiriesPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleInquiriesChange = (newTrigger: number) => {
    // Update refresh trigger from table to update statistics
    setRefreshTrigger(newTrigger);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Inquiries"
        description="Manage user inquiries and technical support requests."
      />

      {/* Statistics */}
      <InquiryStatistics refreshTrigger={refreshTrigger} />

      <SectionCard
        title="Inquiry Management"
        description="View and respond to general inquiries and technical support requests from users."
      >
        <InquiriesTable onInquiriesChange={handleInquiriesChange} />
      </SectionCard>
    </PageContainer>
  );
}
