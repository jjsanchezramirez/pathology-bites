// src/components/question-management/question-management-table.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TagsManagement } from './tags-management'
import { CategoriesManagement } from './categories-management'
import { SetsManagement } from './sets-management'
import { Tag, FolderTree, Database } from 'lucide-react'

export function QuestionManagementTable() {
  const [activeTab, setActiveTab] = useState('tags')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="sets" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Question Sets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tags" className="space-y-4">
          <TagsManagement />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <CategoriesManagement />
        </TabsContent>

        <TabsContent value="sets" className="space-y-4">
          <SetsManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
