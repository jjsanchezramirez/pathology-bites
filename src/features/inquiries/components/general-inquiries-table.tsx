// src/features/inquiries/components/general-inquiries-table.tsx
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
import { Search, Filter, MessageSquare, AlertCircle } from 'lucide-react'
import { InquiryDetailsDialog } from './inquiry-details-dialog'
import { InquiryActionsDropdown } from './inquiry-actions-dropdown'
import { InquiryStatusBadge } from './inquiry-status-badge'
import { toast } from 'sonner'

interface Inquiry {
  id: string
  request_type: string
  first_name: string
  last_name: string
  organization: string | null
  email: string
  inquiry: string
  status: string
  created_at: string
  updated_at: string
}

interface GeneralInquiriesTableProps {
  type: 'general' | 'tech'
}

export function GeneralInquiriesTable({ type }: GeneralInquiriesTableProps) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchInquiries()
  }, [type])

  const fetchInquiries = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('request_type', type)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching inquiries:', error)
        toast.error(`Failed to load ${type} inquiries: ${error.message || 'Unknown error'}`)
        return
      }

      const inquiries = data || []
      setInquiries(inquiries)

      if (inquiries.length === 0) {
        console.log(`No ${type} inquiries found`)
      }
    } catch (error) {
      console.error('Unexpected error fetching inquiries:', error)
      toast.error(`An unexpected error occurred while loading ${type} inquiries`)
    } finally {
      setLoading(false)
    }
  }

  const filteredInquiries = inquiries.filter(inquiry => {
    const matchesSearch = 
      inquiry.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.inquiry.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const handleViewDetails = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry)
    setDetailsOpen(true)
  }

  const handleReply = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry)
    setDetailsOpen(true)
  }

  const handleStatusUpdate = (inquiryId: string, newStatus: string) => {
    setInquiries(prev =>
      prev.map(inquiry =>
        inquiry.id === inquiryId
          ? { ...inquiry, status: newStatus, updated_at: new Date().toISOString() }
          : inquiry
      )
    )
  }

  const handleDelete = (inquiryId: string) => {
    setInquiries(prev => prev.filter(inquiry => inquiry.id !== inquiryId))
  }

  const getStatusBadge = (inquiry: Inquiry) => {
    return <InquiryStatusBadge status={inquiry.status || 'pending'} />
  }

  const isOldInquiry = (createdAt: string) => {
    const inquiryDate = new Date(createdAt)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return inquiryDate < sevenDaysAgo
  }

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="h-10 w-64 bg-muted rounded animate-pulse" />
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
            placeholder="Search inquiries..."
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
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="older">Older</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Contact</TableHead>
              <TableHead>Inquiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInquiries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {inquiries.length === 0
                          ? `No ${type} inquiries available`
                          : `No ${type} inquiries match your search`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inquiries.length === 0
                          ? `${type === 'general' ? 'General' : 'Technical support'} inquiries will appear here when submitted.`
                          : 'Try adjusting your search terms or filters.'
                        }
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredInquiries.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span>{inquiry.first_name} {inquiry.last_name}</span>
                        {isOldInquiry(inquiry.created_at) && (
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{inquiry.email}</div>
                      {inquiry.organization && (
                        <div className="text-xs text-muted-foreground">{inquiry.organization}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="text-sm">
                      {truncateText(inquiry.inquiry)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(inquiry)}</TableCell>
                  <TableCell>
                    {new Date(inquiry.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <InquiryActionsDropdown
                      inquiry={inquiry}
                      onReply={handleReply}
                      onStatusUpdate={handleStatusUpdate}
                      onDelete={handleDelete}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details Dialog */}
      <InquiryDetailsDialog
        inquiry={selectedInquiry}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  )
}
