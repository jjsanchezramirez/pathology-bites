'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { FileText, Brain, Eye, Image as ImageIcon, Upload } from 'lucide-react'

export function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Tabs value="content" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="content" className="flex items-center gap-2 opacity-50">
            <FileText className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="generate" disabled className="flex items-center gap-2 opacity-30">
            <Brain className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="preview" disabled className="flex items-center gap-2 opacity-30">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="images" disabled className="flex items-center gap-2 opacity-30">
            <ImageIcon className="h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="finalize" disabled className="flex items-center gap-2 opacity-30">
            <Upload className="h-4 w-4" />
            Finalize
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="bg-gray-200 dark:bg-gray-700 h-6 w-48 rounded"></CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Selection Skeleton */}
              <div className="space-y-3">
                <div className="bg-gray-200 dark:bg-gray-700 h-4 w-32 rounded"></div>
                <div className="bg-gray-100 dark:bg-gray-800 h-10 w-full rounded border-2 border-dashed border-gray-300 dark:border-gray-600"></div>
              </div>

              {/* Available Files Skeleton */}
              <div className="space-y-3">
                <div className="bg-gray-200 dark:bg-gray-700 h-4 w-40 rounded"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-gray-100 dark:bg-gray-800 h-12 rounded border border-gray-200 dark:border-gray-700 p-3">
                      <div className="bg-gray-200 dark:bg-gray-700 h-4 w-3/4 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Topic Selection Skeleton */}
              <div className="space-y-4">
                <div className="bg-gray-200 dark:bg-gray-700 h-4 w-36 rounded"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="bg-gray-200 dark:bg-gray-700 h-4 w-20 rounded"></div>
                    <div className="bg-gray-100 dark:bg-gray-800 h-10 rounded border border-gray-200 dark:border-gray-700"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gray-200 dark:bg-gray-700 h-4 w-16 rounded"></div>
                    <div className="bg-gray-100 dark:bg-gray-800 h-10 rounded border border-gray-200 dark:border-gray-700"></div>
                  </div>
                </div>
              </div>

              {/* Content Preview Skeleton */}
              <div className="space-y-3">
                <div className="bg-gray-200 dark:bg-gray-700 h-4 w-32 rounded"></div>
                <div className="bg-gray-100 dark:bg-gray-800 h-32 rounded border border-gray-200 dark:border-gray-700 p-4">
                  <div className="space-y-2">
                    <div className="bg-gray-200 dark:bg-gray-700 h-3 w-full rounded"></div>
                    <div className="bg-gray-200 dark:bg-gray-700 h-3 w-5/6 rounded"></div>
                    <div className="bg-gray-200 dark:bg-gray-700 h-3 w-4/5 rounded"></div>
                    <div className="bg-gray-200 dark:bg-gray-700 h-3 w-3/4 rounded"></div>
                  </div>
                </div>
              </div>

              {/* Action Button Skeleton */}
              <div className="flex justify-end">
                <div className="bg-gray-200 dark:bg-gray-700 h-10 w-32 rounded"></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
