"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { toast } from "@/shared/utils/ui/toast";
import { useNotificationRefresh } from "@/shared/contexts/notification-refresh-context";
import { log } from "@/shared/utils/logging";
import { InquiryStatusBadge } from "./inquiry-status-badge";
import { type Inquiry, INQUIRY_TYPE_LABELS } from "../types/inquiries";

interface InquiryDetailsSheetProps {
  inquiry: Inquiry | null;
  onOpenChange: (open: boolean) => void;
  onResolved: (id: string) => void;
}

export function InquiryDetailsSheet({
  inquiry,
  onOpenChange,
  onResolved,
}: InquiryDetailsSheetProps) {
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState<"send" | "resolve" | null>(null);
  const { refreshNotifications } = useNotificationRefresh();

  // A draft belongs to one inquiry; switching rows starts a fresh reply.
  useEffect(() => setResponse(""), [inquiry?.id]);

  const send = async () => {
    if (!inquiry || !response.trim()) return;
    setBusy("send");
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: response.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success(`Reply sent to ${inquiry.email}`);
      setResponse("");
      // The respond route marks the inquiry resolved after sending.
      onResolved(inquiry.id);
      refreshNotifications();
      onOpenChange(false);
    } catch (error) {
      log.error("Error sending response:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send reply");
    } finally {
      setBusy(null);
    }
  };

  const resolve = async () => {
    if (!inquiry) return;
    setBusy("resolve");
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update status");
      }
      toast.success("Marked as resolved");
      onResolved(inquiry.id);
      refreshNotifications();
    } catch (error) {
      log.error("Error updating status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={!!inquiry} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {inquiry && (
          <>
            <SheetHeader className="p-4 pr-10">
              <SheetTitle>
                {inquiry.first_name} {inquiry.last_name}
              </SheetTitle>
              <SheetDescription className="break-all">
                {inquiry.email}
                {inquiry.organization && ` · ${inquiry.organization}`}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <InquiryStatusBadge
                  status={inquiry.status}
                  createdAt={inquiry.created_at ?? undefined}
                />
                <span>{INQUIRY_TYPE_LABELS[inquiry.request_type] ?? inquiry.request_type}</span>
                {inquiry.created_at && (
                  <span>· {format(new Date(inquiry.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                )}
              </div>

              <p className="bg-muted/30 rounded-lg border p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
                {inquiry.inquiry}
              </p>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="inquiry-response">Reply by email</Label>
                <Textarea
                  id="inquiry-response"
                  placeholder="Type your reply..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-muted-foreground text-xs">
                  Sends to {inquiry.email} and marks the inquiry resolved.
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {inquiry.status !== "resolved" && (
                  <Button variant="outline" onClick={resolve} disabled={busy !== null}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {busy === "resolve" ? "Saving..." : "Mark resolved"}
                  </Button>
                )}
                <Button onClick={send} disabled={!response.trim() || busy !== null}>
                  <Send className="mr-2 h-4 w-4" />
                  {busy === "send" ? "Sending..." : "Send reply"}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
