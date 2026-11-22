"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { MessageSquare, Search, Trash2 } from "lucide-react";
import { createClient } from "@/shared/services/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { TableShell, Toolbar } from "@/shared/components/ui/page-layout";
import { toast } from "@/shared/utils/ui/toast";
import { useNotificationRefresh } from "@/shared/contexts/notification-refresh-context";
import { log } from "@/shared/utils/logging";
import { InquiryActionsDropdown } from "./inquiry-actions-dropdown";
import { InquiryStatusBadge } from "./inquiry-status-badge";
import { InquiryDetailsSheet } from "./inquiry-details-sheet";
import { type Inquiry, INQUIRY_TYPE_LABELS } from "../types/inquiries";

type StatusFilter = "pending" | "resolved" | "all";
type TypeFilter = "all" | "general" | "technical";

export function InquiriesTable() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { refreshNotifications } = useNotificationRefresh();

  useEffect(() => {
    const load = async () => {
      const { data, error } = await createClient()
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        log.error("Error fetching inquiries:", error);
        toast.error(`Failed to load inquiries: ${error.message}`);
      } else {
        setInquiries(data ?? []);
      }
      setLoading(false);
    };
    load();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inquiries.filter(
      (i) =>
        (statusFilter === "all" || i.status === statusFilter) &&
        (typeFilter === "all" || i.request_type === typeFilter) &&
        (!q ||
          [i.first_name, i.last_name, i.email, i.organization ?? "", i.inquiry].some((s) =>
            s.toLowerCase().includes(q)
          ))
    );
  }, [inquiries, search, statusFilter, typeFilter]);

  const detail = inquiries.find((i) => i.id === detailId) ?? null;

  const setStatus = (id: string, status: string) =>
    setInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status, updated_at: new Date().toISOString() } : i))
    );

  const remove = (ids: string[]) => {
    setInquiries((prev) => prev.filter((i) => !ids.includes(i.id)));
    setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    if (detailId && ids.includes(detailId)) setDetailId(null);
  };

  const bulkDelete = async () => {
    if (selected.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/inquiries/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryIds: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete inquiries");
      }
      toast.success(`${selected.length} inquir${selected.length === 1 ? "y" : "ies"} deleted`);
      remove(selected);
      refreshNotifications();
    } catch (error) {
      log.error("Error deleting inquiries:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete inquiries");
    } finally {
      setBulkDeleting(false);
    }
  };

  const allSelected = visible.length > 0 && visible.every((i) => selected.includes(i.id));

  const emptyMessage =
    inquiries.length === 0
      ? "No inquiries yet"
      : search || typeFilter !== "all"
        ? "No inquiries match these filters"
        : statusFilter === "pending"
          ? "Nothing waiting for a reply"
          : "No resolved inquiries";

  return (
    <div className="space-y-4">
      <Toolbar>
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search name, email, organization or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <span className="text-sm text-blue-800">{selected.length} selected</span>
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            onClick={bulkDelete}
            disabled={bulkDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {bulkDeleting ? "Deleting..." : "Delete selected"}
          </Button>
        </div>
      )}

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(c) => setSelected(c ? visible.map((i) => i.id) : [])}
                  aria-label="Select all inquiries"
                />
              </TableHead>
              <TableHead>Contact & message</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Received</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <MessageSquare className="text-muted-foreground/50 mx-auto mb-2 h-10 w-10" />
                  <p className="text-muted-foreground text-sm">{emptyMessage}</p>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((inquiry) => (
                <TableRow
                  key={inquiry.id}
                  className="cursor-pointer"
                  onClick={() => setDetailId(inquiry.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.includes(inquiry.id)}
                      onCheckedChange={(c) =>
                        setSelected((prev) =>
                          c ? [...prev, inquiry.id] : prev.filter((id) => id !== inquiry.id)
                        )
                      }
                      aria-label={`Select inquiry from ${inquiry.first_name} ${inquiry.last_name}`}
                    />
                  </TableCell>
                  {/* max-w-0 + w-full: take the leftover width and wrap, instead of
                      letting a long message widen the table past its container. */}
                  <TableCell className="w-full max-w-0">
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm break-words">
                        <button
                          type="button"
                          className="font-medium hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailId(inquiry.id);
                          }}
                        >
                          {inquiry.first_name} {inquiry.last_name}
                        </button>
                        <span className="text-muted-foreground"> · {inquiry.email}</span>
                        {inquiry.organization && (
                          <span className="text-muted-foreground"> · {inquiry.organization}</span>
                        )}
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-sm break-words">
                        {inquiry.inquiry}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                    {INQUIRY_TYPE_LABELS[inquiry.request_type] ?? inquiry.request_type}
                  </TableCell>
                  <TableCell>
                    <InquiryStatusBadge
                      status={inquiry.status}
                      createdAt={inquiry.created_at ?? undefined}
                      className="px-1.5 py-0 text-[10px]"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                    {inquiry.created_at && format(new Date(inquiry.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <InquiryActionsDropdown
                      inquiry={inquiry}
                      onReply={(i) => setDetailId(i.id)}
                      onStatusUpdate={setStatus}
                      onDelete={(id) => remove([id])}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableShell>

      <InquiryDetailsSheet
        inquiry={detail}
        onOpenChange={(open) => !open && setDetailId(null)}
        onResolved={(id) => setStatus(id, "resolved")}
      />
    </div>
  );
}
