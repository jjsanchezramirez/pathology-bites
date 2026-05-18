"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/services/client";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Eye,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCheck,
} from "lucide-react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { QuestionPreviewDialog } from "../dialogs/question-preview-dialog";
import { ReviewActionDialog } from "./review-action-dialog";
import { toast } from "@/shared/utils/ui/toast";
import { formatDistanceToNow } from "date-fns";
import { QuestionWithDetails } from "@/shared/types/questions";
import { CategoryBadge } from "@/shared/components/ui/category-badge";

// Extended type for review queue with joined data
interface ReviewQuestionData {
  id: string;
  title: string;
  stem: string;
  difficulty: string;
  status: string;
  question_set_id: string | null;
  category_id: string | null;
  created_by: string;
  reviewer_id: string | null;
  reviewer_feedback: string | null;
  created_at: string;
  updated_at: string;
  resubmission_notes: string | null;
  question_sets?: { id: string; name: string } | null;
  users?: { first_name: string | null; last_name: string | null; email: string | null } | null;
  categories?: {
    id: string;
    name: string;
    short_form: string | null;
    color: string | null;
    parent_short_form?: string | null;
  } | null;
  creator_name?: string;
  category_name?: string | null;
  category_short_form?: string | null;
}

export function ReviewQueue() {
  const router = useRouter();
  const [questions, setQuestions] = useState<ReviewQuestionData[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<ReviewQuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState<ReviewQuestionData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const { user } = useAuthContext();
  const supabase = createClient();

  const fetchReviewQueue = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch questions assigned to current user with pending_review status - SELECT only needed fields
      const { data, error } = await supabase
        .from("questions")
        .select(
          `
          id,
          title,
          stem,
          difficulty,
          status,
          question_set_id,
          category_id,
          created_by,
          reviewer_id,
          reviewer_feedback,
          created_at,
          updated_at,
          question_sets(id, name),
          users!questions_created_by_fkey(first_name, last_name, email),
          categories(id, name, short_form, color)
        `
        )
        .eq("reviewer_id", user.id)
        .eq("status", "pending_review")
        .order("created_at", { ascending: true }); // Oldest first

      if (error) {
        console.error("Error fetching review queue:", error);
        toast.error(`Failed to load review queue: ${error.message}`);
        return;
      }

      // Batch fetch resubmission notes for all questions in a single query
      const questionIds = (data || []).map((q) => q.id);
      const { data: allReviews } = questionIds.length
        ? await supabase
            .from("question_reviews")
            .select("question_id, changes_made, created_at")
            .in("question_id", questionIds)
            .eq("action", "resubmitted")
            .order("created_at", { ascending: false })
        : { data: [] };

      // Build a map of question_id -> latest resubmission notes
      const notesMap = new Map<string, string | null>();
      for (const review of allReviews || []) {
        if (!notesMap.has(review.question_id)) {
          notesMap.set(review.question_id, review.changes_made?.resubmission_notes || null);
        }
      }

      const questionsWithNotes = (data || []).map((question) => ({
        ...question,
        resubmission_notes: notesMap.get(question.id) || null,
      }));

      // Format creator name and category info
      const formattedData = questionsWithNotes.map((q) => {
        // Handle users (may be object or null)
        const user = Array.isArray(q.users) ? q.users[0] : q.users;
        const category = Array.isArray(q.categories) ? q.categories[0] : q.categories;
        const questionSet = Array.isArray(q.question_sets) ? q.question_sets[0] : q.question_sets;

        return {
          ...q,
          users: user,
          categories: category,
          question_sets: questionSet,
          creator_name:
            user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.email || "Unknown",
          category_name: category?.name || null,
          category_short_form: category?.short_form || null,
        };
      });

      setQuestions(formattedData);
      setFilteredQuestions(formattedData);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Unexpected error fetching review queue:", error);
      toast.error("Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = questions.filter(
        (q) =>
          q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.stem.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.creator_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredQuestions(filtered);
    } else {
      setFilteredQuestions(questions);
    }
  }, [searchTerm, questions]);

  const handlePreview = async (question: ReviewQuestionData) => {
    try {
      // Fetch complete question data with options and images for preview (always fresh)
      const supabase = createClient();
      const { data: fullQuestion, error } = await supabase
        .from("questions")
        .select(
          `
          *,
          question_options (
            id,
            text,
            is_correct,
            explanation,
            order_index
          ),
          question_images (
            image_id,
            question_section,
            order_index,
            image:images (
              id,
              url,
              alt_text,
              description
            )
          ),
          categories (
            id,
            name
          ),
          question_set:question_sets (
            id,
            name
          )
        `
        )
        .eq("id", question.id)
        .single();

      if (error || !fullQuestion) {
        console.error("Error fetching question for preview:", error);
        toast.error("Failed to load question preview");
        return;
      }

      // Map categories -> category for QuestionWithDetails compatibility
      const questionData = fullQuestion as Record<string, unknown>;
      if (questionData.categories) {
        questionData.category = questionData.categories;
      }

      // Fetch tags separately via the join table
      const { data: tagRows } = await supabase
        .from("question_tags")
        .select("tags(id, name)")
        .eq("question_id", question.id);

      if (tagRows) {
        questionData.tags = tagRows
          .map((row) => (row as Record<string, unknown>).tags)
          .filter(Boolean);
      }

      setSelectedQuestion(questionData as unknown as ReviewQuestionData);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error fetching question for preview:", error);
      toast.error("Failed to load question preview");
    }
  };

  const handleReviewAction = (question: ReviewQuestionData, action: "approve" | "reject") => {
    setSelectedQuestion(question);
    setReviewAction(action);
  };

  const handleReviewComplete = async () => {
    setReviewAction(null);
    setSelectedQuestion(null);
    await fetchReviewQueue(); // Refresh the queue and wait for it to complete

    // Force a hard refresh of the entire page to update sidebar and all data
    // This is more reliable than relying on real-time subscriptions
    router.refresh();

    // Also dispatch a custom event that the sidebar can listen to
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("questionStatusChanged"));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;

    setBulkApproving(true);
    try {
      const response = await fetch("/api/admin/questions/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to bulk approve questions");
      }

      const result = await response.json();
      toast.success(
        `${result.approved} question${result.approved !== 1 ? "s" : ""} approved and published`
      );
      if (result.failed > 0) {
        toast.error(
          `${result.failed} question${result.failed !== 1 ? "s" : ""} could not be approved`
        );
      }

      setSelectedIds(new Set());
      await fetchReviewQueue();
      router.refresh();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("questionStatusChanged"));
      }
    } catch (error) {
      console.error("Error bulk approving:", error);
      toast.error(error instanceof Error ? error.message : "Failed to bulk approve questions");
    } finally {
      setBulkApproving(false);
    }
  };

  const getAgeIndicator = (createdAt: string) => {
    const daysOld = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysOld > 7) {
      return (
        <Badge variant="destructive" className="ml-2">
          Urgent
        </Badge>
      );
    } else if (daysOld > 3) {
      return (
        <Badge variant="secondary" className="ml-2">
          Aging
        </Badge>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Review Queue</h1>
        <p className="text-muted-foreground mt-2">Questions assigned to you for review</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questions.length}</div>
            <p className="text-xs text-muted-foreground">Questions awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                questions.filter((q) => {
                  const daysOld = Math.floor(
                    (Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return daysOld > 7;
                }).length
              }
            </div>
            <p className="text-xs text-muted-foreground">Over 7 days old</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Age</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {questions.length > 0
                ? Math.floor(
                    questions.reduce((sum, q) => {
                      return (
                        sum +
                        (Date.now() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24)
                      );
                    }, 0) / questions.length
                  )
                : 0}
              d
            </div>
            <p className="text-xs text-muted-foreground">Average wait time</p>
          </CardContent>
        </Card>
      </div>

      {/* Search, Bulk Actions, and Refresh */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={handleBulkApprove} disabled={bulkApproving}>
              {bulkApproving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              Approve {selectedIds.size} selected
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchReviewQueue();
            router.refresh();
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Questions Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    filteredQuestions.length > 0 && selectedIds.size === filteredQuestions.length
                  }
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all questions"
                />
              </TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  {searchTerm
                    ? "No questions found matching your search"
                    : "No questions in your review queue"}
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => (
                <TableRow
                  key={question.id}
                  data-state={selectedIds.has(question.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(question.id)}
                      onCheckedChange={() => toggleSelection(question.id)}
                      aria-label={`Select ${question.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <div className="font-medium flex items-center">
                        {question.title}
                        {getAgeIndicator(question.created_at)}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem}
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        {question.categories?.id && (
                          <CategoryBadge
                            category={{
                              id: question.categories.id,
                              color: question.categories.color ?? undefined,
                              short_form: question.categories.short_form ?? undefined,
                              parent_short_form: question.categories.parent_short_form ?? undefined,
                              name: question.categories.name,
                            }}
                            label={
                              question.category_short_form ?? question.category_name ?? undefined
                            }
                            className="text-[10px] px-1.5 py-0"
                          />
                        )}
                        {question.question_sets && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {question.question_sets.name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Submitted by <span className="font-medium">{question.creator_name}</span> ·{" "}
                        {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                      </div>
                      {question.resubmission_notes && (
                        <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Changes Made:
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            {question.resubmission_notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handlePreview(question)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReviewAction(question, "approve")}
                      >
                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReviewAction(question, "reject")}
                      >
                        <XCircle className="h-4 w-4 mr-1 text-red-600" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {selectedQuestion && (
        <>
          <QuestionPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            question={selectedQuestion as unknown as QuestionWithDetails}
          />
          {reviewAction && (
            <ReviewActionDialog
              open={true}
              onOpenChange={(open) => !open && setReviewAction(null)}
              question={selectedQuestion}
              action={reviewAction}
              onSuccess={handleReviewComplete}
            />
          )}
        </>
      )}
    </div>
  );
}
