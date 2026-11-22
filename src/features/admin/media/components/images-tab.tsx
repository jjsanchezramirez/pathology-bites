"use client";

import { useRef } from "react";
import { ImagesTable } from "@/features/admin/images/components/image-table";
import {
  StorageStatsCards,
  StorageStatsRef,
} from "@/features/admin/images/components/storage-stats";
import { SectionCard } from "@/shared/components/ui/page-layout";

export function ImagesTab() {
  const storageStatsRef = useRef<StorageStatsRef>(null);

  const handleImageChange = () => {
    // Refresh storage stats when images are added/deleted
    storageStatsRef.current?.refresh();
  };

  return (
    <>
      {/* Storage Statistics Cards */}
      <StorageStatsCards ref={storageStatsRef} />

      <SectionCard
        title="Image Management"
        description="Upload, edit, and organize your image collection. All images are compressed automatically. Search by name, description, or source reference."
      >
        <ImagesTable onImageChange={handleImageChange} />
      </SectionCard>
    </>
  );
}
