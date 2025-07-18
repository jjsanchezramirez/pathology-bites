// src/app/(admin)/admin/inquiries/page.tsx
import { Metadata } from 'next'
import { InquiriesTable } from '@/features/inquiries/components/inquiries-table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card"

export const metadata: Metadata = {
  title: 'Inquiries - Admin Dashboard',
  description: 'Manage user inquiries and question reports',
}

export default function InquiriesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inquiries</h1>
        <p className="text-muted-foreground">
          Manage user inquiries, technical support requests, and question reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inquiry Management</CardTitle>
          <CardDescription>
            View and respond to general inquiries, technical support requests, and question reports from users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InquiriesTable />
        </CardContent>
      </Card>
    </div>
  )
}
