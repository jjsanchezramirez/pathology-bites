// src/app/(admin)/admin/my-questions/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/services/client";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { useUserRole } from "@/shared/hooks/use-user-role";
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
import { Card } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Search,
  Send,
  RefreshCw,
  Plus,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flag,
  Trash2,
} from "lucide-react";
import { QuestionPreviewDialog } from "@/features/admin/questions/components/dialogs/question-preview-dialog";
import { SubmitForReviewDialog } from "@/features/admin/questions/components/dialogs/submit-for-review-dialog";
import { BulkSubmitDialog } from "@/features/admin/questions/components/dialogs/bulk-submit-dialog";
import { toast } from "@/shared/utils/ui/toast";
import { AccessDenied, AccessDeniedPresets } from "@/shared/components/common/access-denied";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { log } from "@/shared/utils/logging";
import {
  type MyQuestion,
  filterQuestions,
  getColSpan,
  pickInitialTab,
  buildMyQuestions,
} from "./my-questions-utils";
import { MyQuestionsSkeleton } from "./my-questions-skeleton";
import { MyQuestionsEmptyState } from "./my-questions-empty-state";
import { MyQuestionRow } from "./my-question-row";
import { DeleteQuestionsDialog } from "./my-questions-dialogs";

export default function MyQuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<MyQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<MyQuestion[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("");
  const [selectedQuestion, setSelectedQuestion] = useState<MyQuestion | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [bulkSubmitDialogOpen, setBulkSubmitDialogOpen] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [collapsedFeedback, setCollapsedFeedback] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const { user } = useAuthContext();
  const { canAccess } = useUserRole();
  const supabase = createClient();

  const fetchMyQuestions = useCallback(
    async (isInitial = false) => {
      if (!user) return;

      try {
        if (isInitial) {
          setInitialLoading(true);
        } else {
          setLoading(true);
        }

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
          published_at,
          created_at,
          updated_at,
          question_set:question_sets(id, name),
          question_options(count),
          question_images(count),
          category:categories(*),
          created_by_user:users!questions_created_by_fkey(
            first_name,
            last_name
          ),
          updated_by_user:users!questions_updated_by_fkey(
            first_name,
            last_name
          ),
          reviewer_user:users!questions_reviewer_id_fkey(
            first_name,
            last_name
          )
        `
          )
          .eq("created_by", user.id)
          .in("status", ["draft", "rejected", "flagged", "pending_review", "published"])
          .order("updated_at", { ascending: false });

        if (error) {
          log.error("Error fetching questions:", error);
          toast.error(`Failed to load questions: ${error.message}`);
          return;
        }

        // Batch-fetch resubmission notes + flag info in parallel, one query each.
        const rejectedIds =
          data?.filter((q) => q.status === "rejected" || q.status === "flagged").map((q) => q.id) ||
          [];
        const flaggedIds = data?.filter((q) => q.status === "flagged").map((q) => q.id) || [];

        const [reviewsResult, flagsResult] = await Promise.all([
          rejectedIds.length
            ? supabase
                .from("question_reviews")
                .select("question_id, changes_made, created_at")
                .in("question_id", rejectedIds)
                .eq("action", "resubmitted")
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          flaggedIds.length
            ? supabase
                .from("question_flags")
                .select(
                  `
                  question_id,
                  flag_type,
                  description,
                  created_at,
                  flagged_by_user:users!question_flags_flagged_by_fkey(first_name, last_name)
                `
                )
                .in("question_id", flaggedIds)
                .eq("status", "open")
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ]);

        const finalData = buildMyQuestions(
          data,
          reviewsResult.data as Record<string, unknown>[] | null,
          flagsResult.data as Record<string, unknown>[] | null
        );
        setQuestions(finalData);
        setFilteredQuestions(finalData);

        // Auto-select the first tab that has pending items (only on initial load)
        if (!activeTab) {
          setActiveTab(pickInitialTab(finalData));
        }
      } catch (error) {
        log.error("Unexpected error fetching questions:", error);
        toast.error("Failed to load questions");
      } finally {
        setInitialLoading(false);
        setLoading(false);
      }
    },
    [user, supabase, activeTab]
  );

  useEffect(() => {
    if (!user) return;
    fetchMyQuestions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    setFilteredQuestions(filterQuestions(questions, { activeTab, searchTerm, difficultyFilter }));
  }, [searchTerm, difficultyFilter, activeTab, questions]);

  // Refresh data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMyQuestions(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchMyQuestions]);

  const handlePreview = async (questionId: string) => {
    try {
      const { data: fullQuestion, error } = await supabase
        .from("questions")
        .select(
          `
          *,
          question_options(*),
          question_images(*, image:images(*)),
          category:categories(*),
          question_set:question_sets(id, name, source_type, short_form),
          created_by_user:users!questions_created_by_fkey(first_name, last_name),
          updated_by_user:users!questions_updated_by_fkey(first_name, last_name),
          reviewer_user:users!questions_reviewer_id_fkey(first_name, last_name)
        `
        )
        .eq("id", questionId)
        .single();

      if (error) {
        log.error("Error fetching question:", error);
        toast.error("Failed to load question preview");
        return;
      }

      // Fetch tags separately via the join table
      const { data: tagRows } = await supabase
        .from("question_tags")
        .select("tags(id, name)")
        .eq("question_id", questionId);

      // The MyQuestion shape predates the typed client: it embeds a partial
      // question_set and a synthesized tags array, so widen at the boundary
      const questionForPreview = fullQuestion as unknown as MyQuestion;
      if (tagRows) {
        questionForPreview.tags = tagRows
          .map((row: Record<string, unknown>) => row.tags)
          .filter(Boolean) as MyQuestion["tags"];
      }

      setSelectedQuestion(questionForPreview);
      setPreviewOpen(true);
    } catch (error) {
      log.error("Error fetching question for preview:", error);
      toast.error("Failed to load question preview");
    }
  };

  const handleEdit = (questionId: string) => {
    const returnUrl = "/admin/my-questions";
    router.push(`/admin/questions/${questionId}/edit?returnUrl=${returnUrl}`);
  };

  const handleEditAndResubmit = (questionId: string) => {
    router.push(`/admin/questions/${questionId}/edit?returnUrl=/admin/my-questions`);
  };

  const handleSubmitForReview = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (question) {
      setSelectedQuestion(question);
      setSubmitDialogOpen(true);
    }
  };

  const handleSubmitSuccess = async () => {
    await fetchMyQuestions();
    setSelectedQuestion(null);
    setSubmitDialogOpen(false);
    setSelectedQuestions(new Set());

    // Dispatch event to update sidebar immediately
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("questionStatusChanged"));
    }

    // Force refresh to update sidebar counts
    router.refresh();
  };

  const handleSelectQuestion = (questionId: string, checked: boolean) => {
    const newSelected = new Set(selectedQuestions);
    if (checked) {
      newSelected.add(questionId);
    } else {
      newSelected.delete(questionId);
    }
    setSelectedQuestions(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select drafts that can be bulk submitted
      const draftIds = filteredQuestions.filter((q) => q.status === "draft").map((q) => q.id);
      setSelectedQuestions(new Set(draftIds));
    } else {
      setSelectedQuestions(new Set());
    }
  };

  const handleBulkSubmitForReview = () => {
    if (selectedQuestions.size === 0) {
      toast.error("No questions selected");
      return;
    }

    if (selectedQuestions.size === 1) {
      const questionId = Array.from(selectedQuestions)[0];
      handleSubmitForReview(questionId);
      return;
    }

    setBulkSubmitDialogOpen(true);
  };

  const handleBulkSubmitConfirm = async (reviewerId: string) => {
    const selectedIds = Array.from(selectedQuestions);

    try {
      const submissions = selectedIds.map((questionId) =>
        fetch(`/api/admin/questions/${questionId}/submit-for-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewer_id: reviewerId }),
        })
      );

      const results = await Promise.allSettled(submissions);
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        toast.error(`Failed to submit ${failures.length} question(s)`);
      } else {
        toast.success(`Successfully submitted ${selectedIds.length} questions for review`);
      }

      setSelectedQuestions(new Set());
      await fetchMyQuestions();

      // Dispatch event to update sidebar immediately
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("questionStatusChanged"));
      }

      // Force refresh to update sidebar counts
      router.refresh();
    } catch (error) {
      log.error("Error in bulk submission:", error);
      toast.error("Failed to submit questions");
    }
  };

  const openDeleteDialog = (ids: string[]) => {
    if (ids.length === 0) {
      toast.error("No questions selected");
      return;
    }
    setDeleteTargetIds(ids);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTargetIds.length === 0) return;
    setDeleting(true);
    try {
      const deletions = deleteTargetIds.map((id) =>
        fetch(`/api/admin/questions/${id}/delete`, { method: "DELETE" })
      );
      const results = await Promise.allSettled(deletions);
      const failures = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
      );

      if (failures.length === deleteTargetIds.length) {
        toast.error(`Failed to delete ${failures.length} question(s)`);
      } else if (failures.length > 0) {
        toast.warning(
          `Deleted ${deleteTargetIds.length - failures.length} of ${deleteTargetIds.length}; ${failures.length} failed`
        );
      } else {
        toast.success(
          deleteTargetIds.length === 1
            ? "Question deleted"
            : `Deleted ${deleteTargetIds.length} questions`
        );
      }

      setDeleteDialogOpen(false);
      setDeleteTargetIds([]);
      setSelectedQuestions(new Set());
      await fetchMyQuestions();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("questionStatusChanged"));
      }
      router.refresh();
    } catch (error) {
      log.error("Error deleting question(s):", error);
      toast.error("Failed to delete question(s)");
    } finally {
      setDeleting(false);
    }
  };

  const toggleFeedback = (questionId: string) => {
    const newCollapsed = new Set(collapsedFeedback);
    if (newCollapsed.has(questionId)) {
      newCollapsed.delete(questionId);
    } else {
      newCollapsed.add(questionId);
    }
    setCollapsedFeedback(newCollapsed);
  };

  // Calculate stats
  const revisionCount = questions.filter((q) => q.status === "rejected").length;
  const flaggedCount = questions.filter((q) => q.status === "flagged").length;
  const draftCount = questions.filter((q) => q.status === "draft").length;
  const underReviewCount = questions.filter((q) => q.status === "pending_review").length;
  const publishedCount = questions.filter((q) => q.status === "published").length;

  const allSelected =
    filteredQuestions.length > 0 &&
    activeTab === "drafts" &&
    selectedQuestions.size === filteredQuestions.length;

  const colSpan = getColSpan(activeTab);
  const hasFilters = !!searchTerm || difficultyFilter !== "all";

  // Access control
  if (!canAccess("questions.create")) {
    return <AccessDenied {...AccessDeniedPresets.creatorOnly} />;
  }

  if (initialLoading) {
    return <MyQuestionsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Questions</h1>
        <p className="text-muted-foreground mt-2">
          Manage your questions across all stages of the review process
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchMyQuestions()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => router.push("/admin/questions/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Question
        </Button>
      </div>

      {/* Bulk Actions Bar (only show for drafts tab) */}
      {selectedQuestions.size > 0 && activeTab === "drafts" && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedQuestions.size} question{selectedQuestions.size !== 1 ? "s" : ""} selected
          </span>
          <Button size="sm" onClick={handleBulkSubmitForReview}>
            <Send className="h-4 w-4 mr-2" />
            Submit Selected for Review
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => openDeleteDialog(Array.from(selectedQuestions))}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger
            value="revision"
            className="flex items-center gap-2 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive"
          >
            <AlertTriangle className="h-4 w-4" />
            Needs Revision ({revisionCount})
          </TabsTrigger>
          <TabsTrigger
            value="flagged"
            className="flex items-center gap-2 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700"
          >
            <Flag className="h-4 w-4" />
            Flagged ({flaggedCount})
          </TabsTrigger>
          <TabsTrigger value="drafts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Drafts ({draftCount})
          </TabsTrigger>
          <TabsTrigger value="under-review" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Under Review ({underReviewCount})
          </TabsTrigger>
          <TabsTrigger value="published" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Published ({publishedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <div className="rounded-md border bg-card overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    {activeTab === "drafts" && (
                      <TableHead className="w-12">
                        <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                      </TableHead>
                    )}
                    <TableHead>Question</TableHead>
                    {activeTab === "published" && <TableHead className="w-24">Version</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="h-24 text-center">
                        <MyQuestionsEmptyState activeTab={activeTab} hasFilters={hasFilters} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuestions.map((question) => (
                      <MyQuestionRow
                        key={question.id}
                        question={question}
                        activeTab={activeTab}
                        isCollapsed={collapsedFeedback.has(question.id)}
                        isSelected={selectedQuestions.has(question.id)}
                        colSpan={colSpan}
                        onToggleFeedback={toggleFeedback}
                        onSelectQuestion={handleSelectQuestion}
                        onPreview={handlePreview}
                        onEditAndResubmit={handleEditAndResubmit}
                        onSubmitForReview={handleSubmitForReview}
                        onEdit={handleEdit}
                        onDelete={openDeleteDialog}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {selectedQuestion && (
        <>
          <QuestionPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            question={selectedQuestion}
          />
          <SubmitForReviewDialog
            open={submitDialogOpen}
            onOpenChange={setSubmitDialogOpen}
            questionId={selectedQuestion.id}
            questionTitle={selectedQuestion.title}
            questionStatus={selectedQuestion.status}
            onSuccess={handleSubmitSuccess}
          />
        </>
      )}

      <BulkSubmitDialog
        open={bulkSubmitDialogOpen}
        onOpenChange={setBulkSubmitDialogOpen}
        questionCount={selectedQuestions.size}
        onConfirm={handleBulkSubmitConfirm}
      />

      <DeleteQuestionsDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        count={deleteTargetIds.length}
        deleting={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
