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
import { Mail, Building, Calendar, User } from 'lucide-react'
import { useState } from 'react'

interface Inquiry {
  id: string
  request_type: string
  first_name: string
  last_name: string
  organization: string | null
  email: string
  inquiry: string
  created_at: string
}

interface InquiryDetailsDialogProps {
  inquiry: Inquiry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InquiryDetailsDialog({ inquiry, open, onOpenChange }: InquiryDetailsDialogProps) {
  const [response, setResponse] = useState('')

  if (!inquiry) return null

  const handleSendResponse = () => {
    // In a real implementation, this would send an email response
    console.log('Sending response:', response)
    // You could integrate with an email service here
    setResponse('')
    onOpenChange(false)
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Inquiry Details
          </DialogTitle>
          <DialogDescription>
            Review and respond to this user inquiry
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Inquiry Type */}
          <div className="flex items-center gap-2">
            <Badge className={getTypeColor(inquiry.request_type)}>
              {inquiry.request_type === 'general' ? 'General Inquiry' : 'Technical Support'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Submitted {new Date(inquiry.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Name
              </Label>
              <p className="text-sm font-medium">
                {inquiry.first_name} {inquiry.last_name}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <p className="text-sm font-medium">{inquiry.email}</p>
            </div>

            {inquiry.organization && (
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Organization
                </Label>
                <p className="text-sm font-medium">{inquiry.organization}</p>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Submitted
              </Label>
              <p className="text-sm font-medium">
                {new Date(inquiry.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <Separator />

          {/* Inquiry Content */}
          <div className="space-y-2">
            <Label>Inquiry Message</Label>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{inquiry.inquiry}</p>
            </div>
          </div>

          <Separator />

          {/* Response Section */}
          <div className="space-y-4">
            <Label htmlFor="response">Response (Optional)</Label>
            <Textarea
              id="response"
              placeholder="Type your response here..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              This response will be sent to {inquiry.email}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button 
              onClick={handleSendResponse}
              disabled={!response.trim()}
            >
              Send Response
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
