// src/features/admin/notifications/components/system-update-broadcaster.tsx
// Form for broadcasting a system update notification. Rendered inside the
// "Send announcement" dialog on the admin Users page.

"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { toast } from "@/shared/utils/ui/toast";
import { Megaphone, Send, Loader2 } from "lucide-react";
import { apiClient } from "@/shared/utils/api/api-client";
import { log } from "@/shared/utils/logging";

interface SystemUpdateForm {
  title: string;
  message: string;
  updateType: "maintenance" | "feature" | "announcement" | "security";
  severity: "info" | "warning" | "critical";
  targetAudience: "all" | "user" | "staff";
}

export function SystemUpdateBroadcaster({ onSent }: { onSent?: () => void } = {}) {
  const [form, setForm] = useState<SystemUpdateForm>({
    title: "",
    message: "",
    updateType: "announcement",
    severity: "info",
    targetAudience: "all",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/api/admin/notifications/system-update", form);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to broadcast system update");
      }

      const result = await response.json();
      toast.success("Announcement sent");

      // Reset form
      setForm({
        title: "",
        message: "",
        updateType: "announcement",
        severity: "info",
        targetAudience: "all",
      });

      log.debug("System update broadcasted:", result);
      onSent?.();
    } catch (error) {
      log.error("Error broadcasting system update:", error);
      toast.error(error instanceof Error ? error.message : "Failed to broadcast system update");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTypeOptions = [
    { value: "announcement", label: "Announcement", description: "General announcements and news" },
    { value: "feature", label: "New Feature", description: "New features and improvements" },
    {
      value: "maintenance",
      label: "Maintenance",
      description: "Scheduled maintenance and downtime",
    },
    { value: "security", label: "Security Update", description: "Security-related updates" },
  ];

  const severityOptions = [
    { value: "info", label: "Info", description: "General information", color: "text-blue-600" },
    {
      value: "warning",
      label: "Warning",
      description: "Important notices",
      color: "text-yellow-600",
    },
    { value: "critical", label: "Critical", description: "Urgent updates", color: "text-red-600" },
  ];

  const audienceOptions = [
    { value: "all", label: "Everyone", description: "Every active account" },
    { value: "user", label: "Learners", description: "Accounts with the user role" },
    { value: "staff", label: "Staff", description: "Admins and users with any permission" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Short headline"
          required
        />
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          placeholder="What do people need to know?"
          rows={4}
          required
        />
      </div>

      {/* Update Type */}
      <div className="space-y-2">
        <Label htmlFor="updateType">Type</Label>
        <Select
          value={form.updateType}
          onValueChange={(value: SystemUpdateForm["updateType"]) =>
            setForm((prev) => ({ ...prev, updateType: value }))
          }
        >
          <SelectTrigger id="updateType">
            <SelectValue placeholder="Select update type" />
          </SelectTrigger>
          <SelectContent>
            {updateTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {updateTypeOptions.find((o) => o.value === form.updateType)?.description}
        </p>
      </div>

      {/* Severity */}
      <div className="space-y-2">
        <Label htmlFor="severity">Severity</Label>
        <Select
          value={form.severity}
          onValueChange={(value: SystemUpdateForm["severity"]) =>
            setForm((prev) => ({ ...prev, severity: value }))
          }
        >
          <SelectTrigger id="severity">
            <SelectValue placeholder="Select severity" />
          </SelectTrigger>
          <SelectContent>
            {severityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className={option.color}>{option.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {severityOptions.find((o) => o.value === form.severity)?.description}
        </p>
      </div>

      {/* Target Audience */}
      <div className="space-y-2">
        <Label htmlFor="targetAudience">Audience</Label>
        <Select
          value={form.targetAudience}
          onValueChange={(value: SystemUpdateForm["targetAudience"]) =>
            setForm((prev) => ({ ...prev, targetAudience: value }))
          }
        >
          <SelectTrigger id="targetAudience">
            <SelectValue placeholder="Select target audience" />
          </SelectTrigger>
          <SelectContent>
            {audienceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {audienceOptions.find((o) => o.value === form.targetAudience)?.description}
        </p>
      </div>

      {/* Preview */}
      {(form.title || form.message) && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                <Megaphone className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="break-words text-sm font-medium">
                  {form.title || "Notification Title"}
                </div>
                <div className="break-words text-sm text-muted-foreground">
                  {form.message || "Notification message will appear here..."}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      form.severity === "critical"
                        ? "bg-red-100 text-red-800"
                        : form.severity === "warning"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {form.updateType.replace("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || !form.title.trim() || !form.message.trim()}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send announcement
          </>
        )}
      </Button>
    </form>
  );
}
