// src/features/inquiries/components/inquiry-details-dialog.tsx
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
import { Textarea } from "@/shared/components/ui/textarea"
import { Label } from "@/shared/components/ui/label"
import { Separator } from "@/shared/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Mail, Building, Calendar, User, Send, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { InquiryStatusBadge } from './inquiry-status-badge'

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

interface InquiryDetailsDialogProps {
  inquiry: Inquiry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InquiryDetailsDialog({ inquiry, open, onOpenChange }: InquiryDetailsDialogProps) {
  const [response, setResponse] = useState('')
  const [sending, setSending] = useState(false)

  if (!inquiry) return null

  const handleSendResponse = async () => {
    if (!response.trim()) return

    setSending(true)
    try {
      console.log('Sending response for inquiry:', inquiry.id)

      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ response: response.trim() }),
      })

      console.log('Response status:', res.status)

      if (!res.ok) {
        let errorMessage = 'Failed to send response'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          errorMessage = `HTTP ${res.status}: ${res.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await res.json()
      console.log('Response sent successfully:', result)

      toast.success('Response sent successfully!')
      setResponse('')
      onOpenChange(false)
    } catch (error) {
      console.error('Error sending response:', error)

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        toast.error('Network error: Unable to connect to server. Please check your connection and try again.')
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to send response')
      }
    } finally {
      setSending(false)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'general':
        return 'bg-blue-100 text-blue-800'
      case 'tech':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <MessageSquare className="h-6 w-6 text-primary" />
            Inquiry Details
          </DialogTitle>
          <DialogDescription className="text-base">
            Review and respond to this user inquiry
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Header with Type and Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={getTypeColor(inquiry.request_type)} variant="secondary">
                {inquiry.request_type === 'general' ? 'General Inquiry' : 'Technical Support'}
              </Badge>
              <InquiryStatusBadge status={inquiry.status} />
            </div>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(inquiry.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Contact Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="text-base font-medium">
                    {inquiry.first_name} {inquiry.last_name}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="text-base font-medium text-primary">{inquiry.email}</p>
                </div>

                {inquiry.organization && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-sm font-medium text-muted-foreground">Organization</Label>
                    <p className="text-base font-medium">{inquiry.organization}</p>
                  </div>
                )}

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Submitted</Label>
                  <p className="text-base font-medium">
                    {new Date(inquiry.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inquiry Message Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Inquiry Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 p-4 rounded-lg border">
                <p className="text-base leading-relaxed whitespace-pre-wrap">{inquiry.inquiry}</p>
              </div>
            </CardContent>
          </Card>

          {/* Response Section Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Response
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="response" className="text-sm font-medium">
                  Your Response
                </Label>
                <Textarea
                  id="response"
                  placeholder="Type your response here..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  This response will be sent to {inquiry.email}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="px-6"
            >
              Close
            </Button>
            <Button
              onClick={handleSendResponse}
              disabled={!response.trim() || sending}
              className="px-6 flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Response
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
