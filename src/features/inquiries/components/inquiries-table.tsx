// src/features/inquiries/components/inquiries-table.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { GeneralInquiriesTable } from './general-inquiries-table'
import { MessageSquare, HelpCircle, CheckCircle } from 'lucide-react'

interface InquiriesTableProps {
  onInquiriesChange?: () => void
}

export function InquiriesTable({ onInquiriesChange }: InquiriesTableProps) {
  const [activeTab, setActiveTab] = useState('pending-general')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending-general" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Pending General
          </TabsTrigger>
          <TabsTrigger value="pending-tech" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Pending Tech
          </TabsTrigger>
          <TabsTrigger value="solved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Solved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending-general" className="space-y-4">
          <GeneralInquiriesTable
            type="general"
            statusFilter="pending"
            onInquiriesChange={onInquiriesChange}
          />
        </TabsContent>

        <TabsContent value="pending-tech" className="space-y-4">
          <GeneralInquiriesTable
            type="tech"
            statusFilter="pending"
            onInquiriesChange={onInquiriesChange}
          />
        </TabsContent>

        <TabsContent value="solved" className="space-y-4">
          <GeneralInquiriesTable
            type="all"
            statusFilter="solved"
            onInquiriesChange={onInquiriesChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
