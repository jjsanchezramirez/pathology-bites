'use client'

import { useState } from 'react'
import { MoreHorizontal, Reply, CheckCircle, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
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

interface InquiryActionsDropdownProps {
  inquiry: Inquiry
  onReply: (inquiry: Inquiry) => void
  onStatusUpdate: (inquiryId: string, newStatus: string) => void
  onDelete: (inquiryId: string) => void
}

export function InquiryActionsDropdown({
  inquiry,
  onReply,
  onStatusUpdate,
  onDelete
}: InquiryActionsDropdownProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleMarkAsResolved = async () => {
    if (inquiry.status === 'resolved') {
      toast.info('Inquiry is already resolved')
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiry.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'resolved' }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update status')
      }

      toast.success('Inquiry marked as resolved')
      onStatusUpdate(inquiry.id, 'resolved')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete inquiry')
      }

      toast.success('Inquiry deleted successfully')
      onDelete(inquiry.id)
    } catch (error) {
      console.error('Error deleting inquiry:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete inquiry')
    } finally {
      setDeleteDialogOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onReply(inquiry)}>
            <Reply className="mr-2 h-4 w-4" />
            Reply
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleMarkAsResolved}
            disabled={isUpdating || inquiry.status === 'resolved'}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {inquiry.status === 'resolved' ? 'Already Resolved' : 'Mark as Resolved'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inquiry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inquiry from {inquiry.first_name} {inquiry.last_name}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
