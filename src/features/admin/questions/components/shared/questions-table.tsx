"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/utils/ui/toast";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useQuestions } from "@/features/admin/questions/hooks/use-questions";
import { QuestionWithDetails } from "@/shared/types/questions";
import { useQuestionSets } from "@/features/admin/questions/hooks/use-question-sets";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { ComponentErrorBoundary } from "@/shared/components/common";
import { DeleteQuestionDialog } from "../dialogs/delete-question-dialog";
import { VersionHistoryDialog } from "../versioning/version-history-dialog";
import { QuestionPreviewDialog } from "../dialogs/question-preview-dialog";
import { ChangeCategoryDialog } from "../dialogs/change-category-dialog";
import { ChangeSetDialog } from "../dialogs/change-set-dialog";
import { createClient } from "@/shared/services/client";
import { BlurredDialog } from "@/shared/components/ui/blurred-dialog";
import { apiClient } from "@/shared/utils/api/api-client";
import { useRouter } from "next/navigation";
import { log } from "@/shared/utils/logging";
import {
  DEFAULT_PAGE_SIZE,
  TableControls,
  TablePagination,
  QuestionRow,
} from "./questions-table-parts";

interface QuestionsTableProps {
  adminMode?: string;
}

export function QuestionsTable({ adminMode = "admin" }: QuestionsTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [questionSetFilter, setQuestionSetFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Debounce search term
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchInput = useCallback((value: string) => {
    setSearchTerm(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(value);
      setPage(0);
    }, 350);
  }, []);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Get user role to determine admin access
  const { role } = useUserRole();
  const isActualAdmin = role === "admin";

  // Use adminMode to determine what features to show (but still check actual permissions for security)
  const showAdminFeatures = adminMode === "admin" && isActualAdmin;

  const supabase = createClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionWithDetails | null>(null);
  const [questionForHistory, setQuestionForHistory] = useState<QuestionWithDetails | null>(null);
  const [questionToPreview, setQuestionToPreview] = useState<QuestionWithDetails | null>(null);
  const [showChangeCategoryDialog, setShowChangeCategoryDialog] = useState(false);
  const [showChangeSetDialog, setShowChangeSetDialog] = useState(false);
  const [questionToChangeCategory, setQuestionToChangeCategory] =
    useState<QuestionWithDetails | null>(null);
  const [questionToChangeSet, setQuestionToChangeSet] = useState<QuestionWithDetails | null>(null);

  // Fetch questions with current filters
  const { questions, total, loading, error, refetch, deleteQuestion } = useQuestions({
    page,
    pageSize,
    searchTerm: debouncedSearchTerm || undefined,
    difficulty: difficultyFilter === "all" ? undefined : difficultyFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    questionSetId: questionSetFilter === "all" ? undefined : questionSetFilter,
    categoryId: categoryFilter === "all" ? undefined : categoryFilter,
  });

  // Fetch question sets for filter dropdown
  const { questionSets } = useQuestionSets();

  const totalPages = Math.ceil(total / pageSize);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(0); // Reset to first page when changing page size
  }, []);

  const handleSearch = handleSearchInput;

  const handleCategoryChange = useCallback((value: string) => {
    setCategoryFilter(value);
    setPage(0);
  }, []);

  const handleDifficultyChange = useCallback((value: string) => {
    setDifficultyFilter(value);
    setPage(0);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(0);
  }, []);

  const handleQuestionSetChange = useCallback((value: string) => {
    setQuestionSetFilter(value);
    setPage(0);
  }, []);

  const handleEdit = useCallback(
    (question: QuestionWithDetails) => {
      // Navigate to the edit page with returnUrl to current page
      const currentPath = window.location.pathname + window.location.search;
      router.push(
        `/admin/questions/${question.id}/edit?returnUrl=${encodeURIComponent(currentPath)}`
      );
    },
    [router]
  );

  const handleDelete = useCallback((question: QuestionWithDetails) => {
    setQuestionToDelete(question);
    setShowDeleteDialog(true);
  }, []);

  const handleViewHistory = useCallback((question: QuestionWithDetails) => {
    setQuestionForHistory(question);
    setShowVersionHistory(true);
  }, []);

  const handleEditCategory = useCallback((question: QuestionWithDetails) => {
    setQuestionToChangeCategory(question);
    setShowChangeCategoryDialog(true);
  }, []);

  const handleEditSet = useCallback((question: QuestionWithDetails) => {
    setQuestionToChangeSet(question);
    setShowChangeSetDialog(true);
  }, []);

  const handlePreview = useCallback(
    async (question: QuestionWithDetails) => {
      try {
        // Fetch complete question data with options and images for preview
        const { data: fullQuestion, error } = await supabase
          .from("questions")
          .select(
            `
          id,
          title,
          stem,
          difficulty,
          teaching_point,
          question_references,
          status,
          question_set_id,
          category_id,
          lesson,
          topic,
          anki_card_id,
          anki_deck_name,
          created_by,
          updated_by,
          reviewer_id,
          reviewer_feedback,
          published_at,
          created_at,
          updated_at,
          version_major,
          version_minor,
          version_patch,
          question_options(*),
          question_images(*, image:images(*)),
          categories(*),
          question_sets(
            id,
            name,
            source_type,
            short_form
          ),
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
          .eq("id", question.id)
          .single();

        if (error) {
          log.error("Error fetching full question data:", error);
          toast.error("Failed to load question details");
          return;
        }

        setQuestionToPreview(fullQuestion);
        setShowPreviewDialog(true);
      } catch (error) {
        log.error("Error fetching question for preview:", error);
        toast.error("Failed to load question preview");
      }
    },
    [supabase]
  );

  const handleExportQuestion = useCallback(async (question: QuestionWithDetails) => {
    try {
      const response = await fetch(`/api/admin/questions/${question.id}/export`);
      if (!response.ok) {
        throw new Error("Failed to export question");
      }

      const questionData = await response.json();

      // Create and download the file
      const blob = new Blob([JSON.stringify(questionData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `question-${question.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Question exported successfully");
    } catch (error) {
      log.error("Error exporting question:", error);
      toast.error("Failed to export question");
    }
  }, []);

  const handleExportAll = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/questions/export-all");
      if (!response.ok) {
        throw new Error("Failed to export questions");
      }

      const questionsData = await response.json();

      // Create and download the file
      const blob = new Blob([JSON.stringify(questionsData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pathology-bites-questions-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("All questions exported successfully");
    } catch (error) {
      log.error("Error exporting questions:", error);
      toast.error("Failed to export questions");
    }
  }, []);

  // Bulk selection handlers
  const handleSelectQuestion = useCallback((questionId: string, checked: boolean) => {
    setSelectedQuestions((prev) =>
      checked ? [...prev, questionId] : prev.filter((id) => id !== questionId)
    );
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allQuestionIds = questions?.map((q) => q.id) || [];
        setSelectedQuestions(allQuestionIds);
      } else {
        setSelectedQuestions([]);
      }
    },
    [questions]
  );

  // Bulk operations
  const handleBulkOperation = useCallback(
    async (action: string) => {
      if (selectedQuestions.length === 0) {
        toast.error("Please select questions first");
        return;
      }

      // Show confirmation dialog for delete action
      if (action === "delete") {
        setShowBulkDeleteConfirm(true);
        return;
      }

      try {
        const response = await apiClient.post("/api/admin/questions/bulk", {
          action,
          questionIds: selectedQuestions,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed to ${action} questions`);
        }

        // Handle export differently
        if (action === "export") {
          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `pathology-bites-questions-bulk-export-${new Date().toISOString().split("T")[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success(`Successfully exported ${data.count} question(s)`);
        } else {
          toast.success(
            data.message ||
              `Successfully ${action.replace("_", " ")}ed ${data.affectedCount} question(s)`
          );
          refetch();
          // Refresh to update sidebar counts
          router.refresh();
        }

        setSelectedQuestions([]);
      } catch (error) {
        log.error(`Error performing bulk ${action}:`, error);
        toast.error(error instanceof Error ? error.message : `Failed to ${action} questions`);
      }
    },
    [selectedQuestions, refetch, router]
  );

  // Confirmed bulk delete handler
  const handleConfirmedBulkDelete = useCallback(async () => {
    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/admin/questions/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "delete",
          questionIds: selectedQuestions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete questions");
      }

      toast.success(data.message || `Successfully deleted ${data.affectedCount} question(s)`);
      refetch();
      // Refresh to update sidebar counts
      router.refresh();
      setSelectedQuestions([]);
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      log.error("Error performing bulk delete:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete questions");
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedQuestions, refetch, router]);

  // Load questions when component mounts or filters change
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch identity changes with params, which is intentional
  }, [
    page,
    pageSize,
    debouncedSearchTerm,
    categoryFilter,
    difficultyFilter,
    statusFilter,
    questionSetFilter,
  ]);

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-red-600">Error loading questions: {error}</p>
        <Button onClick={refetch} className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <ComponentErrorBoundary componentName="Questions Table">
      <div className="space-y-4">
        <TableControls
          onSearch={handleSearch}
          onCategoryChange={handleCategoryChange}
          onDifficultyChange={handleDifficultyChange}
          onStatusChange={handleStatusChange}
          onQuestionSetChange={handleQuestionSetChange}
          onExportAll={handleExportAll}
          categoryFilter={categoryFilter}
          difficultyFilter={difficultyFilter}
          statusFilter={statusFilter}
          questionSetFilter={questionSetFilter}
          questionSets={questionSets}
          selectedQuestions={selectedQuestions}
          onBulkOperation={handleBulkOperation}
          isAdmin={showAdminFeatures}
        />

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                {showAdminFeatures && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedQuestions.length === questions?.length && questions.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="min-w-[320px]">Title</TableHead>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[70px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {showAdminFeatures && (
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-4 mx-auto" />
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-4 mx-auto" />
                    </TableCell>
                    <TableCell className="min-w-[320px]">
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex items-center gap-1.5">
                          <Skeleton className="h-4 w-16 rounded-full" />
                          <Skeleton className="h-4 w-20 rounded-full" />
                          <Skeleton className="h-4 w-14 rounded-full" />
                          <Skeleton className="h-4 w-12 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-8 w-8 mx-auto rounded" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8 ml-auto rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : questions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showAdminFeatures ? 5 : 4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {searchTerm ||
                    categoryFilter !== "all" ||
                    difficultyFilter !== "all" ||
                    statusFilter !== "all" ||
                    questionSetFilter !== "all"
                      ? "No questions found matching your filters"
                      : "No questions created yet"}
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question) => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onViewHistory={handleViewHistory}
                    onPreview={handlePreview}
                    onExport={handleExportQuestion}
                    onEditCategory={showAdminFeatures ? handleEditCategory : undefined}
                    onEditSet={showAdminFeatures ? handleEditSet : undefined}
                    isSelected={selectedQuestions.includes(question.id)}
                    onSelect={handleSelectQuestion}
                    isAdmin={showAdminFeatures}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={total}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />

        {/* Preview Dialog */}
        <QuestionPreviewDialog
          question={questionToPreview}
          open={showPreviewDialog}
          onOpenChange={setShowPreviewDialog}
        />

        {/* Version History Dialog */}
        <VersionHistoryDialog
          questionId={questionForHistory?.id || null}
          questionTitle={questionForHistory?.title}
          open={showVersionHistory}
          onOpenChange={setShowVersionHistory}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteQuestionDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          question={questionToDelete}
          onSuccess={() => {
            // Refresh the questions list
            refetch();
            // Refresh to update sidebar counts
            router.refresh();
          }}
          onDelete={deleteQuestion}
        />

        {/* Change Category Dialog */}
        <ChangeCategoryDialog
          open={showChangeCategoryDialog}
          onOpenChange={setShowChangeCategoryDialog}
          onSuccess={refetch}
          question={questionToChangeCategory}
        />

        {/* Change Question Set Dialog */}
        <ChangeSetDialog
          open={showChangeSetDialog}
          onOpenChange={setShowChangeSetDialog}
          onSuccess={refetch}
          question={questionToChangeSet}
        />

        {/* Bulk Delete Confirmation Dialog */}
        <BlurredDialog
          open={showBulkDeleteConfirm}
          onOpenChange={setShowBulkDeleteConfirm}
          title="Delete Selected Questions"
          description={`Are you sure you want to delete ${selectedQuestions.length} selected question${selectedQuestions.length === 1 ? "" : "s"}? This action cannot be undone.`}
          maxWidth="md"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBulkDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmedBulkDelete}
                disabled={isBulkDeleting}
                variant="destructive"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  `Delete ${selectedQuestions.length} Question${selectedQuestions.length === 1 ? "" : "s"}`
                )}
              </Button>
            </>
          }
        >
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will permanently remove the selected questions from the database. Questions that
              are currently approved or in use may not be deletable based on your permissions.
            </p>
          </div>
        </BlurredDialog>
      </div>
    </ComponentErrorBoundary>
  );
}
