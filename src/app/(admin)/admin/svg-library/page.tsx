"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Plus } from "lucide-react";
import { SvgTable } from "@/features/admin/svg-library/components/svg-table";
import { SvgUploadDialog } from "@/features/admin/svg-library/components/upload-dialog";
import { EditSvgDialog } from "@/features/admin/svg-library/components/edit-dialog";
import { DeleteSvgDialog } from "@/features/admin/svg-library/components/delete-dialog";
import type { SvgAsset } from "@/features/admin/svg-library/types";

export default function AdminSvgLibraryPage() {
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SVG Assets</h1>
        <p className="text-muted-foreground">
          Manage SVG illustrations, diagrams, and vector graphics
        </p>
      </div>

      {/* SVG Management Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>SVG Library</CardTitle>
              <CardDescription>
                Upload, edit, and organize your SVG asset collection. Use the search to find assets
                by name or description.
              </CardDescription>
            </div>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload SVG
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SvgTable onEdit={handleEdit} onDelete={handleDelete} refreshKey={refreshKey} />
        </CardContent>
      </Card>

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
    </div>
  );
}
