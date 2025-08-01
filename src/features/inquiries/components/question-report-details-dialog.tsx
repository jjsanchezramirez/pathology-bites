// src/features/inquiries/components/question-report-details-dialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Separator } from "@/shared/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { AlertTriangle, User, Calendar, FileQuestion, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface QuestionReport {
  id: string
  question_id: string
  reported_by: string
  report_type: string
  description: string | null
  status: string
  created_at: string
  updated_at: string
  question?: {
    title: string
  }
  reporter?: {
    first_name: string
    last_name: string
    email: string
  }
}

interface QuestionReportDetailsDialogProps {
  report: QuestionReport | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate: (reportId: string, newStatus: string) => void
}

export function QuestionReportDetailsDialog({ 
  report, 
  open, 
  onOpenChange, 
  onStatusUpdate 
}: QuestionReportDetailsDialogProps) {
  if (!report) return null

  const handleStatusChange = (newStatus: string) => {
    onStatusUpdate(report.id, newStatus)
  }

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'incorrect_answer':
        return 'bg-red-100 text-red-800'
      case 'unclear_question':
        return 'bg-yellow-100 text-yellow-800'
      case 'technical_issue':
        return 'bg-blue-100 text-blue-800'
      case 'inappropriate_content':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'reviewing':
        return 'bg-blue-100 text-blue-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'dismissed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatReportType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Question Report Details
          </DialogTitle>
          <DialogDescription>
            Review and manage this question report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Report Status and Type */}
          <div className="flex items-center gap-4">
            <Badge className={getTypeColor(report.report_type)}>
              {formatReportType(report.report_type)}
            </Badge>
            <Badge className={getStatusColor(report.status)}>
              {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Reported {new Date(report.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Question Information */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                Reported Question
              </Label>
              <Link href={`/admin/questions?id=${report.question_id}`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Question
                </Button>
              </Link>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium">
                {report.question?.title || 'Question title not available'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Question ID: {report.question_id}
              </p>
            </div>
          </div>

          {/* Reporter Information */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Reported By
            </Label>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium">
                {report.reporter ? 
                  `${report.reporter.first_name} ${report.reporter.last_name}` : 
                  'Unknown User'
                }
              </p>
              {report.reporter && (
                <p className="text-xs text-muted-foreground mt-1">
                  {report.reporter.email}
                </p>
              )}
            </div>
          </div>

          {/* Report Description */}
          {report.description && (
            <div className="space-y-2">
              <Label>Report Description</Label>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{report.description}</p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created
              </Label>
              <p className="text-sm font-medium">
                {new Date(report.created_at).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last Updated
              </Label>
              <p className="text-sm font-medium">
                {new Date(report.updated_at).toLocaleString()}
              </p>
            </div>
          </div>

          <Separator />

          {/* Status Management */}
          <div className="space-y-4">
            <Label>Update Status</Label>
            <Select value={report.status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Link href={`/admin/questions?id=${report.question_id}`}>
              <Button>
                Edit Question
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
