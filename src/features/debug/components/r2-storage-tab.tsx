// src/features/debug/components/r2-storage-tab.tsx
/**
 * R2 Storage Tab - Dedicated tab for Cloudflare R2 storage management
 * Provides comprehensive file browsing across multiple buckets
 */

'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import {
  HardDrive,
  ImageIcon,
  Database,
  FolderOpen
} from 'lucide-react'

import { R2FileBrowser } from './r2-file-browser'

export function R2StorageTab() {
  const [activeTab, setActiveTab] = useState('images-bucket')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center space-x-2">
          <HardDrive className="h-6 w-6" />
          <span>Cloudflare R2 Storage</span>
        </h2>
        <p className="text-gray-600">
          Browse and manage files across Cloudflare R2 storage buckets with enhanced folder navigation.
          Navigate through directories and organize your content efficiently.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="images-bucket" className="flex items-center space-x-2">
            <ImageIcon className="h-4 w-4" />
            <span>Images Bucket</span>
          </TabsTrigger>
          <TabsTrigger value="data-bucket" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Data Bucket</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images-bucket">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <ImageIcon className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold">Images Bucket</h3>
              <Badge variant="outline">pathology-bites-images</Badge>
              <Badge variant="secondary" className="text-xs">Public</Badge>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Medical images, microscopic slides, visual content, and Anki media files organized in folders.
              Navigate through the <code className="text-xs bg-gray-100 px-1 rounded">anki/</code> subfolder to access flashcard media.
            </p>
            <R2FileBrowser defaultBucket="pathology-bites-images" />
          </div>
        </TabsContent>

        <TabsContent value="data-bucket">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-green-500" />
              <h3 className="text-lg font-semibold">Data Bucket</h3>
              <Badge variant="outline">pathology-bites-data</Badge>
              <Badge variant="secondary" className="text-xs">Private</Badge>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              JSON files, datasets, structured data, and configuration files organized in folders.
              Browse through different directories to find specific data types.
            </p>
            <R2FileBrowser defaultBucket="pathology-bites-data" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
