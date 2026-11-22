// src/app/(admin)/admin/images/page.tsx
"use client";

import { useRef } from "react";
import { ImagesTable } from "@/features/admin/images/components/image-table";
import {
  StorageStatsCards,
  StorageStatsRef,
} from "@/features/admin/images/components/storage-stats";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";

export default function ImagesPage() {
  const storageStatsRef = useRef<StorageStatsRef>(null);

  const handleImageChange = () => {
    // Refresh storage stats when images are added/deleted
    storageStatsRef.current?.refresh();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Image Library"
        description="Manage and organize pathology images, diagrams, and illustrations"
      />

      {/* Storage Statistics Cards */}
      <StorageStatsCards ref={storageStatsRef} />

      <SectionCard
        title="Image Management"
        description="Upload, edit, and organize your image collection. All images are compressed automatically. Search by name, description, or source reference."
      >
        <ImagesTable onImageChange={handleImageChange} />
      </SectionCard>
    </PageContainer>
  );
}
