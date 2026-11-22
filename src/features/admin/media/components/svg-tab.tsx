"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Plus } from "lucide-react";
import { SvgTable } from "@/features/admin/svg-library/components/svg-table";
import { SvgUploadDialog } from "@/features/admin/svg-library/components/upload-dialog";
import { EditSvgDialog } from "@/features/admin/svg-library/components/edit-dialog";
import { DeleteSvgDialog } from "@/features/admin/svg-library/components/delete-dialog";
import type { SvgAsset } from "@/features/admin/svg-library/types";

export function SvgTab() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SvgAsset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<SvgAsset | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleEdit = (asset: SvgAsset) => {
    setSelectedAsset(asset);
    setEditDialogOpen(true);
  };

  const handleDelete = (asset: SvgAsset) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <SectionCard
        title="SVG Library"
        description="Upload, edit, and organize your SVG asset collection. Search by name or description."
        actions={
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload SVG
          </Button>
        }
      >
        <SvgTable onEdit={handleEdit} onDelete={handleDelete} refreshKey={refreshKey} />
      </SectionCard>

      {/* Upload Dialog */}
      <SvgUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={refresh}
      />

      {/* Edit Dialog */}
      <EditSvgDialog
        asset={selectedAsset}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={refresh}
      />

      {/* Delete Dialog */}
      <DeleteSvgDialog
        asset={assetToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={refresh}
      />
    </>
  );
}
