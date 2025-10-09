// src/app/(admin)/admin/inquiries/page.tsx
'use client'

import { useState } from 'react'
import { InquiriesTable } from '@/features/inquiries/components/inquiries-table'
import { InquiryStatistics } from '@/features/inquiries/components/inquiry-statistics'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card"

export default function InquiriesPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleInquiriesChange = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inquiries</h1>
        <p className="text-muted-foreground">
          Manage user inquiries and technical support requests.
        </p>
      </div>

      {/* Statistics */}
      <InquiryStatistics refreshTrigger={refreshTrigger} />

      <Card>
        <CardHeader>
          <CardTitle>Inquiry Management</CardTitle>
          <CardDescription>
            View and respond to general inquiries and technical support requests from users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InquiriesTable onInquiriesChange={handleInquiriesChange} />
        </CardContent>
      </Card>
    </div>
  )
}
