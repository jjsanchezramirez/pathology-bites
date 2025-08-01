// src/features/inquiries/components/question-reports-table.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Input } from "@/shared/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Eye, Search, Filter, ExternalLink, AlertTriangle } from 'lucide-react'
import { QuestionReportDetailsDialog } from './question-report-details-dialog'
import { toast } from 'sonner'
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
  // Joined data
  question?: {
    title: string
  }
  reporter?: {
    first_name: string
    last_name: string
    email: string
  }
}

export function QuestionReportsTable() {
  const [reports, setReports] = useState<QuestionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedReport, setSelectedReport] = useState<QuestionReport | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('question_reports')
        .select(`
          *,
          questions!inner(title),
          users!question_reports_reported_by_fkey(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching question reports:', error)
        toast.error(`Failed to load question reports: ${error.message || 'Unknown error'}`)
        return
      }

      const reports = data || []
      setReports(reports)

      if (reports.length === 0) {
        console.log('No question reports found')
      }
    } catch (error) {
      console.error('Unexpected error fetching question reports:', error)
      toast.error('An unexpected error occurred while loading question reports')
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.question?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reporter?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reporter?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.report_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.description && report.description.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || report.status === statusFilter
    const matchesType = typeFilter === 'all' || report.report_type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const handleViewDetails = (report: QuestionReport) => {
    setSelectedReport(report)
    setDetailsOpen(true)
  }

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('question_reports')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)

      if (error) {
        console.error('Error updating report status:', error)
        toast.error(`Failed to update report status: ${error.message || 'Unknown error'}`)
        return
      }

      toast.success(`Report status updated to ${newStatus}`)
      fetchReports() // Refresh the data
    } catch (error) {
      console.error('Unexpected error updating report status:', error)
      toast.error('An unexpected error occurred while updating report status')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge variant="default">Pending</Badge>
      case 'reviewing':
        return <Badge variant="secondary">Reviewing</Badge>
      case 'resolved':
        return <Badge variant="outline" className="text-green-600 border-green-600">Resolved</Badge>
      case 'dismissed':
        return <Badge variant="outline" className="text-gray-600 border-gray-600">Dismissed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'incorrect_answer':
        return <Badge variant="destructive">Incorrect Answer</Badge>
      case 'unclear_question':
        return <Badge variant="secondary">Unclear Question</Badge>
      case 'technical_issue':
        return <Badge variant="outline">Technical Issue</Badge>
      case 'inappropriate_content':
        return <Badge variant="destructive">Inappropriate</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="h-10 w-64 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="border rounded-lg">
          <div className="h-12 bg-muted rounded-t-lg animate-pulse" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 border-t bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="incorrect_answer">Incorrect Answer</SelectItem>
            <SelectItem value="unclear_question">Unclear Question</SelectItem>
            <SelectItem value="technical_issue">Technical Issue</SelectItem>
            <SelectItem value="inappropriate_content">Inappropriate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/50" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {reports.length === 0
                          ? 'No question reports available'
                          : 'No question reports match your search'
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reports.length === 0
                          ? 'Question reports will appear here when users report issues with questions.'
                          : 'Try adjusting your search terms or filters.'
                        }
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {report.question?.title || 'Unknown Question'}
                  </TableCell>
                  <TableCell>
                    {report.reporter ? 
                      `${report.reporter.first_name} ${report.reporter.last_name}` : 
                      'Unknown User'
                    }
                  </TableCell>
                  <TableCell>{getTypeBadge(report.report_type)}</TableCell>
                  <TableCell>{getStatusBadge(report.status)}</TableCell>
                  <TableCell>
                    {new Date(report.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(report)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Link href={`/admin/questions?id=${report.question_id}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details Dialog */}
      <QuestionReportDetailsDialog
        report={selectedReport}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onStatusUpdate={updateReportStatus}
      />
    </div>
  )
}
