// src/features/inquiries/components/inquiries-table.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { GeneralInquiriesTable } from './general-inquiries-table'
import { MessageSquare, HelpCircle } from 'lucide-react'

export function InquiriesTable() {
  const [activeTab, setActiveTab] = useState('general')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            General Inquiries
          </TabsTrigger>
          <TabsTrigger value="tech" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Tech Support
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <GeneralInquiriesTable type="general" />
        </TabsContent>

        <TabsContent value="tech" className="space-y-4">
          <GeneralInquiriesTable type="tech" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
