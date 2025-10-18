// src/features/inquiries/components/inquiries-table.tsx
'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { GeneralInquiriesTable } from './general-inquiries-table'
import { MessageSquare, HelpCircle, CheckCircle, Inbox } from 'lucide-react'
import { INQUIRY_TYPES } from '../types/inquiries'
import { createClient } from '@/shared/services/client'
import { Badge } from '@/shared/components/ui/badge'

interface InquiriesTableProps {
  onInquiriesChange?: (refreshTrigger: number) => void
}

interface TabCounts {
  pendingGeneral: number
  pendingTech: number
  solved: number
  all: number
}

export function InquiriesTable({ onInquiriesChange }: InquiriesTableProps) {
  const [activeTab, setActiveTab] = useState('all')
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    pendingGeneral: 0,
    pendingTech: 0,
    solved: 0,
    all: 0
  })
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    fetchTabCounts()
  }, [refreshTrigger])

  const fetchTabCounts = async () => {
    try {
      const { data: inquiries, error } = await supabase
        .from('inquiries')
        .select('request_type, status')

      if (error) {
        console.error('Error fetching tab counts:', error)
        return
      }

      const data = inquiries || []
      const counts = {
        pendingGeneral: data.filter(i => i.request_type === 'general' && i.status === 'pending').length,
        pendingTech: data.filter(i => i.request_type === INQUIRY_TYPES.TECH && i.status === 'pending').length,
        solved: data.filter(i => i.status === 'resolved' || i.status === 'closed').length,
        all: data.length
      }
      setTabCounts(counts)
    } catch (error) {
      console.error('Error calculating tab counts:', error)
    }
  }

  const handleInquiriesChange = () => {
    // Trigger a refresh of all tabs by incrementing the refresh trigger
    setRefreshTrigger(prev => {
      const newTrigger = prev + 1
      // Pass the new trigger value to parent so statistics also update
      onInquiriesChange?.(newTrigger)
      return newTrigger
    })
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            All Inquiries
            {tabCounts.all > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tabCounts.all}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending-general" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Pending General
            {tabCounts.pendingGeneral > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {tabCounts.pendingGeneral}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending-tech" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Pending Tech
            {tabCounts.pendingTech > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {tabCounts.pendingTech}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="solved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Solved
            {tabCounts.solved > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tabCounts.solved}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <GeneralInquiriesTable
            type="all"
            statusFilter="all"
            onInquiriesChange={handleInquiriesChange}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        <TabsContent value="pending-general" className="space-y-4">
          <GeneralInquiriesTable
            type="general"
            statusFilter="pending"
            onInquiriesChange={handleInquiriesChange}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        <TabsContent value="pending-tech" className="space-y-4">
          <GeneralInquiriesTable
            type={INQUIRY_TYPES.TECH}
            statusFilter="pending"
            onInquiriesChange={handleInquiriesChange}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        <TabsContent value="solved" className="space-y-4">
          <GeneralInquiriesTable
            type="all"
            statusFilter="solved"
            onInquiriesChange={handleInquiriesChange}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
