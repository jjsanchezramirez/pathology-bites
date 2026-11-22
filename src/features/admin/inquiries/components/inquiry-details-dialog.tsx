// src/features/inquiries/components/inquiry-details-dialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Mail, Calendar, User, Send, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "@/shared/utils/ui/toast";
import { InquiryStatusBadge } from "./inquiry-status-badge";
import { log } from "@/shared/utils/logging";

interface Inquiry {
  id: string;
  request_type: string;
  first_name: string;
  last_name: string;
  organization: string | null;
  email: string;
  inquiry: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface InquiryDetailsDialogProps {
  inquiry: Inquiry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InquiryDetailsDialog({ inquiry, open, onOpenChange }: InquiryDetailsDialogProps) {
  const [response, setResponse] = useState("");
  const [sending, setSending] = useState(false);

  if (!inquiry) return null;

  const handleSendResponse = async () => {
    if (!response.trim()) return;

    setSending(true);
    try {
      log.debug("Sending response for inquiry:", inquiry.id);

      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ response: response.trim() }),
      });

      log.debug("Response status:", res.status);

      if (!res.ok) {
        let errorMessage = "Failed to send response";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          log.error("Failed to parse error response:", parseError);
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await res.json();
      log.debug("Response sent successfully:", result);

      toast.success("Response sent successfully!");
      setResponse("");
      onOpenChange(false);
    } catch (error) {
      log.error("Error sending response:", error);

      if (error instanceof TypeError && error.message === "Failed to fetch") {
        toast.error(
          "Network error: Unable to connect to server. Please check your connection and try again."
        );
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to send response");
      }
    } finally {
      setSending(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "general":
        return "border-blue-300 bg-blue-50 text-blue-700";
      case "tech":
        return "border-orange-300 bg-orange-50 text-orange-700";
      default:
        return "border-gray-300 bg-gray-50 text-gray-700";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Inquiry Details
          </DialogTitle>
          <DialogDescription>Review and respond to this user inquiry</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-6">
          {/* Header with Type and Status */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={getTypeColor(inquiry.request_type)} variant="outline">
                {inquiry.request_type === "general" ? "General Inquiry" : "Technical Support"}
              </Badge>
              <InquiryStatusBadge status={inquiry.status} />
            </div>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {new Date(inquiry.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Contact Information Card */}
          <SectionCard title="Contact Information" icon={User}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <p className="text-sm font-medium">
                  {inquiry.first_name} {inquiry.last_name}
                </p>
              </div>

              <div className="min-w-0 space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="break-all text-sm font-medium text-primary">{inquiry.email}</p>
              </div>

              {inquiry.organization && (
                <div className="min-w-0 space-y-1 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Organization</Label>
                  <p className="text-sm font-medium">{inquiry.organization}</p>
                </div>
              )}

              <div className="min-w-0 space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Submitted</Label>
                <p className="text-sm font-medium">
                  {new Date(inquiry.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Inquiry Message Card */}
          <SectionCard title="Inquiry Message" icon={MessageSquare}>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {inquiry.inquiry}
              </p>
            </div>
          </SectionCard>

          {/* Response Section Card */}
          <SectionCard title="Send Response" icon={Send}>
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
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="min-w-0 break-all">
                  This response will be sent to {inquiry.email}
                </span>
              </p>
            </div>
          </SectionCard>

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleSendResponse}
              disabled={!response.trim() || sending}
              className="flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
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
  );
}
