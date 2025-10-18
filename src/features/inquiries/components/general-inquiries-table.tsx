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
import { Search, Filter, MessageSquare, AlertCircle, Trash2 } from 'lucide-react'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { InquiryDetailsDialog } from './inquiry-details-dialog'
import { InquiryActionsDropdown } from './inquiry-actions-dropdown'
import { InquiryStatusBadge, getStatusSortOrder } from './inquiry-status-badge'
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
  type: 'general' | 'technical' | 'all'
  statusFilter?: 'pending' | 'solved' | 'all'
  onInquiriesChange?: () => void
  refreshTrigger?: number
}

export function GeneralInquiriesTable({ type, statusFilter = 'all', onInquiriesChange, refreshTrigger }: GeneralInquiriesTableProps) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedInquiries, setSelectedInquiries] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchInquiries()
  }, [type, statusFilter, refreshTrigger])

  const fetchInquiries = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('inquiries')
        .select('*')

      // Apply type filter
      if (type !== 'all') {
        query = query.eq('request_type', type)
      }

      // Apply status filter
      if (statusFilter === 'pending') {
        query = query.eq('status', 'pending')
      } else if (statusFilter === 'solved') {
        query = query.in('status', ['resolved', 'closed'])
      } else if (statusFilter === 'all') {
        // No additional filter needed - get all statuses
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching inquiries:', error)
        toast.error(`Failed to load inquiries: ${error.message || 'Unknown error'}`)
        return
      }

      let inquiries = data || []

      // For "all" tab, sort by status priority: red (delayed) → yellow (pending) → green (resolved)
      if (type === 'all' && statusFilter === 'all') {
        inquiries = inquiries.sort((a, b) => {
          const orderA = getStatusSortOrder(a.status, a.created_at)
          const orderB = getStatusSortOrder(b.status, b.created_at)
          if (orderA !== orderB) {
            return orderA - orderB
          }
          // If same status priority, sort by created_at (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      }

      setInquiries(inquiries)

      if (inquiries.length === 0) {
        console.log(`No inquiries found for type: ${type}, status: ${statusFilter}`)
      }
    } catch (error) {
      console.error('Unexpected error fetching inquiries:', error)
      toast.error(`An unexpected error occurred while loading inquiries`)
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
    setSelectedInquiries(prev => prev.filter(id => id !== inquiryId))
    onInquiriesChange?.()
  }

  const handleSelectInquiry = (inquiryId: string, checked: boolean) => {
    if (checked) {
      setSelectedInquiries(prev => [...prev, inquiryId])
    } else {
      setSelectedInquiries(prev => prev.filter(id => id !== inquiryId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInquiries(filteredInquiries.map(inquiry => inquiry.id))
    } else {
      setSelectedInquiries([])
    }
  }

  const handleBulkDelete = async () => {
    if (selectedInquiries.length === 0) return

    setBulkDeleting(true)
    try {
      const response = await fetch('/api/admin/inquiries/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inquiryIds: selectedInquiries }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete inquiries')
      }

      toast.success(`${selectedInquiries.length} inquiries deleted successfully`)

      // Remove deleted inquiries from local state
      setInquiries(prev => prev.filter(inquiry => !selectedInquiries.includes(inquiry.id)))
      setSelectedInquiries([])
      onInquiriesChange?.()
    } catch (error) {
      console.error('Error deleting inquiries:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete inquiries')
    } finally {
      setBulkDeleting(false)
    }
  }

  const getStatusBadge = (inquiry: Inquiry) => {
    return <InquiryStatusBadge status={inquiry.status || 'pending'} createdAt={inquiry.created_at} />
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

  const getEmptyStateMessage = () => {
    if (statusFilter === 'pending') {
      return type === 'all' ? 'No pending inquiries' : `No pending ${type} inquiries`
    } else if (statusFilter === 'solved') {
      return 'No solved inquiries'
    }
    return `No ${type} inquiries available`
  }

  const getEmptyStateSubMessage = () => {
    if (statusFilter === 'pending') {
      return type === 'all' ? 'Pending inquiries will appear here.' : `Pending ${type} inquiries will appear here.`
    } else if (statusFilter === 'solved') {
      return 'Solved inquiries will appear here.'
    }
    return `${type === 'general' ? 'General' : type === 'technical' ? 'Technical support' : ''} inquiries will appear here when submitted.`
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
      {/* Filters and Bulk Actions */}
      <div className="space-y-4">
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
        </div>

        {/* Bulk Actions Bar */}
        {selectedInquiries.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm text-blue-800">
              {selectedInquiries.length} inquiry{selectedInquiries.length !== 1 ? 'ies' : ''} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={filteredInquiries.length > 0 && selectedInquiries.length === filteredInquiries.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all inquiries"
                />
              </TableHead>
              <TableHead>Contact & Inquiry</TableHead>
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
                          ? getEmptyStateMessage()
                          : 'No inquiries match your search'
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inquiries.length === 0
                          ? getEmptyStateSubMessage()
                          : 'Try adjusting your search terms.'
                        }
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredInquiries.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedInquiries.includes(inquiry.id)}
                      onCheckedChange={(checked) => handleSelectInquiry(inquiry.id, checked as boolean)}
                      aria-label={`Select inquiry from ${inquiry.first_name} ${inquiry.last_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {/* Line 1: Name • Email */}
                      <div className="text-sm">
                        <span className="font-medium">{inquiry.first_name} {inquiry.last_name}</span>
                        <span className="text-muted-foreground"> • {inquiry.email}</span>
                        {inquiry.organization && (
                          <span className="text-muted-foreground"> • {inquiry.organization}</span>
                        )}
                      </div>
                      {/* Line 2: Inquiry Text */}
                      <div className="text-sm text-muted-foreground">
                        {truncateText(inquiry.inquiry)}
                      </div>
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
