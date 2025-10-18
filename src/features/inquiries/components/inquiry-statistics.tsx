// src/features/inquiries/components/inquiry-statistics.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { MessageSquare, CheckCircle, Clock, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { INQUIRY_TYPES } from '../types/inquiries'

interface InquiryStats {
  totalInquiries: number
  pendingGeneral: number
  pendingTech: number
  resolvedInquiries: number
}

interface InquiryStatisticsProps {
  onStatsChange?: () => void
  refreshTrigger?: number
}

export function InquiryStatistics({ onStatsChange, refreshTrigger }: InquiryStatisticsProps) {
  const [stats, setStats] = useState<InquiryStats>({
    totalInquiries: 0,
    pendingGeneral: 0,
    pendingTech: 0,
    resolvedInquiries: 0
  })
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchStats = async () => {
    try {
      setLoading(true)

      // Get all inquiries with their status and type
      const { data: inquiries, error } = await supabase
        .from('inquiries')
        .select('request_type, status')

      if (error) {
        console.error('Error fetching inquiry statistics:', error)
        toast.error('Failed to load inquiry statistics')
        return
      }

      const inquiriesData = inquiries || []

      // Calculate statistics
      const totalInquiries = inquiriesData.length
      const pendingGeneral = inquiriesData.filter(
        (inquiry) => inquiry.request_type === 'general' && inquiry.status === 'pending'
      ).length
      const pendingTech = inquiriesData.filter(
        (inquiry) => inquiry.request_type === INQUIRY_TYPES.TECH && inquiry.status === 'pending'
      ).length
      const resolvedInquiries = inquiriesData.filter(
        (inquiry) => inquiry.status === 'resolved' || inquiry.status === 'closed'
      ).length

      setStats({
        totalInquiries,
        pendingGeneral,
        pendingTech,
        resolvedInquiries
      })

      onStatsChange?.()
    } catch (error) {
      console.error('Unexpected error fetching inquiry statistics:', error)
      toast.error('An unexpected error occurred while loading statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [refreshTrigger])

  const StatCard = ({
    title,
    value,
    icon: Icon
  }: {
    title: string
    value: number
    icon: any
  }) => (
    <Card className="bg-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? (
            <div className="h-8 w-12 bg-muted rounded animate-pulse" />
          ) : (
            value
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Inquiries"
        value={stats.totalInquiries}
        icon={MessageSquare}
      />
      <StatCard
        title="Pending General"
        value={stats.pendingGeneral}
        icon={Clock}
      />
      <StatCard
        title="Pending Tech"
        value={stats.pendingTech}
        icon={HelpCircle}
      />
      <StatCard
        title="Resolved"
        value={stats.resolvedInquiries}
        icon={CheckCircle}
      />
    </div>
  )
}
