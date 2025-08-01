// src/app/(admin)/admin/images/page.tsx
'use client'

import { useRef } from 'react'
import { ImagesTable } from '@/features/images/components/image-table'
import { StorageStatsCards, StorageStatsRef } from '@/features/images/components/storage-stats'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card"

export default function ImagesPage() {
  const storageStatsRef = useRef<StorageStatsRef>(null);

  const handleImageChange = () => {
    // Refresh storage stats when images are added/deleted
    storageStatsRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Image Library</h1>
        <p className="text-muted-foreground">
          Manage and organize pathology images, diagrams, and illustrations
        </p>
      </div>

      {/* Storage Statistics Cards */}
      <StorageStatsCards ref={storageStatsRef} />

      <Card>
        <CardHeader>
          <CardTitle>Image Management</CardTitle>
          <CardDescription>
            Upload, edit, and organize your image collection. Images larger than 1MB will be automatically compressed.
            Use the search to find images by name, description, or source reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImagesTable onImageChange={handleImageChange} />
        </CardContent>
      </Card>
    </div>
  )
}