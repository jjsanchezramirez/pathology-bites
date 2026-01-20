// src/app/(admin)/admin/my-questions/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/services/client";
import { useAuth } from "@/shared/hooks/use-auth";
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
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Card } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Eye,
  Search,
  Edit3,
  Send,
  RefreshCw,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { QuestionPreviewDialog } from "@/features/questions/components/question-preview-dialog";
import { SubmitForReviewDialog } from "@/features/questions/components/submit-for-review-dialog";
import { BulkSubmitDialog } from "@/features/questions/components/bulk-submit-dialog";
import { toast } from "@/shared/utils/toast";
import { formatDistanceToNow } from "date-fns";
import { QuestionWithDetails, DIFFICULTY_CONFIG } from "@/features/questions/types/questions";
import { AccessDenied, AccessDeniedPresets } from "@/shared/components/common/access-denied";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface MyQuestion extends QuestionWithDetails {
  creator_name?: string;
  resubmission_notes?: string;
  resubmission_date?: string;
}

export default function MyQuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<MyQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<MyQuestion[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("revision");
  const [selectedQuestion, setSelectedQuestion] = useState<MyQuestion | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [bulkSubmitDialogOpen, setBulkSubmitDialogOpen] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [collapsedFeedback, setCollapsedFeedback] = useState<Set<string>>(new Set());

  const { user } = useAuth({ minimal: true });
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
          teaching_point,
          question_references,
          status,
          question_set_id,
          category_id,
          created_by,
          reviewer_id,
          reviewer_feedback,
          published_at,
          created_at,
          updated_at,
          question_sets(id, name),
          question_options(id, text, is_correct, explanation, order_index),
          question_images(
            question_section,
            order_index,
            images(id, url, alt_text, description)
          ),
          categories(*),
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
          .in("status", ["draft", "rejected", "pending_review", "published"])
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("Error fetching questions:", error);
          toast.error(`Failed to load questions: ${error.message}`);
          return;
        }

        // Fetch resubmission notes for rejected questions
        const rejectedQuestions = data?.filter((q) => q.status === "rejected") || [];
        const questionsWithNotes = await Promise.all(
          rejectedQuestions.map(async (question) => {
            const { data: reviewData } = await supabase
              .from("question_reviews")
              .select("changes_made, created_at")
              .eq("question_id", question.id)
              .eq("action", "resubmitted")
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            return {
              ...question,
              resubmission_notes: reviewData?.changes_made?.resubmission_notes,
              resubmission_date: reviewData?.created_at,
            };
          })
        );

        // Merge resubmission notes back into data
        const questionsMap = new Map(data?.map((q) => [q.id, q]));
        questionsWithNotes.forEach((q) => {
          questionsMap.set(q.id, q);
        });

        const finalData = Array.from(questionsMap.values()) as unknown as MyQuestion[];
        setQuestions(finalData);
        setFilteredQuestions(finalData);

        // Auto-select priority tab if there are rejected questions
        if (rejectedQuestions.length > 0 && activeTab === "revision") {
          setActiveTab("revision");
        }
      } catch (error) {
        console.error("Unexpected error fetching questions:", error);
        toast.error("Failed to load questions");
      } finally {
        setInitialLoading(false);
        setLoading(false);
      }
    },
    [user, supabase, activeTab]
  );

  useEffect(() => {
    fetchMyQuestions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let filtered = questions;

    // Apply tab filter
    if (activeTab === "revision") {
      filtered = filtered.filter((q) => q.status === "rejected");
    } else if (activeTab === "drafts") {
      filtered = filtered.filter((q) => q.status === "draft");
    } else if (activeTab === "under-review") {
      filtered = filtered.filter((q) => q.status === "pending_review");
    } else if (activeTab === "published") {
      filtered = filtered.filter((q) => q.status === "published");
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (q) =>
          q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.stem.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply difficulty filter
    if (difficultyFilter !== "all") {
      filtered = filtered.filter((q) => q.difficulty?.toLowerCase() === difficultyFilter);
    }

    setFilteredQuestions(filtered);
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
          categories(*),
          question_sets(id, name, source_type, short_form),
          created_by_user:users!questions_created_by_fkey(first_name, last_name),
          updated_by_user:users!questions_updated_by_fkey(first_name, last_name),
          reviewer_user:users!questions_reviewer_id_fkey(first_name, last_name)
        `
        )
        .eq("id", questionId)
        .single();

      if (error) {
        console.error("Error fetching question:", error);
        toast.error("Failed to load question preview");
        return;
      }

      setSelectedQuestion(fullQuestion);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error fetching question for preview:", error);
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('questionStatusChanged'));
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
        fetch(`/api/questions/${questionId}/submit-for-review`, {
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('questionStatusChanged'));
      }

      // Force refresh to update sidebar counts
      router.refresh();
    } catch (error) {
      console.error("Error in bulk submission:", error);
      toast.error("Failed to submit questions");
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

  const getAgeIndicator = (updatedAt: string) => {
    const daysOld = Math.floor(
      (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysOld > 7) {
      return (
        <Badge variant="destructive" className="ml-2 text-xs">
          Urgent
        </Badge>
      );
    } else if (daysOld > 3) {
      return (
        <Badge variant="secondary" className="ml-2 text-xs">
          Aging
        </Badge>
      );
    }
    return null;
  };

  // Calculate stats
  const revisionCount = questions.filter((q) => q.status === "rejected").length;
  const draftCount = questions.filter((q) => q.status === "draft").length;
  const underReviewCount = questions.filter((q) => q.status === "pending_review").length;
  const publishedCount = questions.filter((q) => q.status === "published").length;

  const allSelected =
    filteredQuestions.length > 0 &&
    activeTab === "drafts" &&
    selectedQuestions.size === filteredQuestions.length;

  // Calculate column span based on active tab
  const getColSpan = () => {
    if (activeTab === "drafts") return 5;
    if (activeTab === "published") return 5;
    return 4;
  };

  // Access control
  if (!canAccess("questions.create")) {
    return <AccessDenied {...AccessDeniedPresets.creatorOnly} />;
  }

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-56 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="space-y-4">
          <div className="flex gap-2 border-b">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="rounded-md border bg-card">
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
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
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger
            value="revision"
            className="flex items-center gap-2 data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive"
          >
            <AlertTriangle className="h-4 w-4" />
            Needs Revision ({revisionCount})
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
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      {activeTab === "drafts" && (
                        <TableHead className="w-12">
                          <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                        </TableHead>
                      )}
                      {activeTab === "published" ? (
                        <>
                          <TableHead>Question</TableHead>
                          <TableHead className="w-24">Version</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Question</TableHead>
                          <TableHead>{activeTab === "revision" ? "Rejected" : "Updated"}</TableHead>
                        </>
                      )}
                      <TableHead>Difficulty</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={getColSpan()} className="h-24 text-center">
                          <div className="text-center py-6">
                            {activeTab === "revision" && (
                              <>
                                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-medium mb-2">
                                  No questions need revision
                                </h3>
                                <p className="text-muted-foreground">
                                  {searchTerm || difficultyFilter !== "all"
                                    ? "No questions match your filters"
                                    : "Great work! You have no rejected questions to revise."}
                                </p>
                              </>
                            )}
                            {activeTab === "drafts" && (
                              <>
                                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-medium mb-2">No drafts yet</h3>
                                <p className="text-muted-foreground">
                                  {searchTerm || difficultyFilter !== "all"
                                    ? "No questions match your filters"
                                    : "Create a new question to get started"}
                                </p>
                              </>
                            )}
                            {activeTab === "under-review" && (
                              <>
                                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-medium mb-2">Nothing under review</h3>
                                <p className="text-muted-foreground">
                                  {searchTerm || difficultyFilter !== "all"
                                    ? "No questions match your filters"
                                    : "Submit draft questions to see them here"}
                                </p>
                              </>
                            )}
                            {activeTab === "published" && (
                              <>
                                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-medium mb-2">No published questions</h3>
                                <p className="text-muted-foreground">
                                  {searchTerm || difficultyFilter !== "all"
                                    ? "No questions match your filters"
                                    : "Questions appear here once approved by reviewers"}
                                </p>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuestions.map((question) => {
                        const isCollapsed = collapsedFeedback.has(question.id);
                        const showFeedback = activeTab === "revision" && question.reviewer_feedback;

                        return (
                          <React.Fragment key={question.id}>
                            <TableRow>
                              {activeTab === "drafts" && (
                                <TableCell>
                                  <Checkbox
                                    checked={selectedQuestions.has(question.id)}
                                    onCheckedChange={(checked) =>
                                      handleSelectQuestion(question.id, !!checked)
                                    }
                                  />
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="space-y-3">
                                  {/* Question Title */}
                                  <div className="flex items-start gap-2">
                                    {showFeedback && (
                                      <button
                                        onClick={() => toggleFeedback(question.id)}
                                        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
                                        aria-label={
                                          isCollapsed ? "Expand feedback" : "Collapse feedback"
                                        }
                                      >
                                        {isCollapsed ? (
                                          <ChevronRight className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </button>
                                    )}
                                    {!showFeedback && activeTab === "revision" && (
                                      <div className="w-6 flex-shrink-0" />
                                    )}
                                    <div className="flex-1">
                                      <div className="font-medium flex items-center">
                                        {question.title}
                                        {activeTab === "revision" &&
                                          getAgeIndicator(question.updated_at)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Question Stem */}
                                  <div className="flex gap-2">
                                    {activeTab === "revision" && (
                                      <div className="w-6 flex-shrink-0" />
                                    )}
                                    <div className="text-sm text-muted-foreground line-clamp-2 flex-1">
                                      {question.stem}
                                    </div>
                                  </div>

                                  {/* Updated timestamp for Published tab */}
                                  {activeTab === "published" && (
                                    <div className="text-xs text-muted-foreground">
                                      Updated{" "}
                                      {formatDistanceToNow(new Date(question.updated_at), {
                                        addSuffix: true,
                                      })}
                                    </div>
                                  )}

                                  {/* Question Set Badge */}
                                  {question.question_set && (
                                    <div className="flex gap-2">
                                      {activeTab === "revision" && (
                                        <div className="w-6 flex-shrink-0" />
                                      )}
                                      <Badge variant="outline" className="text-xs">
                                        {question.question_set.name}
                                      </Badge>
                                    </div>
                                  )}

                                  {/* Resubmission Notes */}
                                  {activeTab === "revision" && question.resubmission_notes && (
                                    <div className="flex gap-2">
                                      <div className="w-6 flex-shrink-0" />
                                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 dark:border-blue-600 rounded-md flex-1">
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1 min-w-0">
                                            <span className="text-xs font-medium text-blue-900 dark:text-blue-100 block mb-1">
                                              Previous Changes Made
                                            </span>
                                            <p className="text-xs text-blue-800 dark:text-blue-300">
                                              {question.resubmission_notes}
                                            </p>
                                            {question.resubmission_date && (
                                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                {formatDistanceToNow(
                                                  new Date(question.resubmission_date)
                                                )}{" "}
                                                ago
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              {/* Version column only for Published tab */}
                              {activeTab === "published" ? (
                                <TableCell>
                                  <div className="text-sm font-mono">
                                    {question.version_string ||
                                      `v${question.version_major || 1}.${question.version_minor || 0}.${question.version_patch || 0}`}
                                  </div>
                                </TableCell>
                              ) : (
                                <TableCell>
                                  <div className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(new Date(question.updated_at), {
                                      addSuffix: true,
                                    })}
                                  </div>
                                </TableCell>
                              )}
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`border ${DIFFICULTY_CONFIG[question.difficulty as keyof typeof DIFFICULTY_CONFIG]?.color || "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800"}`}
                                >
                                  {question.difficulty}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePreview(question.id)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Preview
                                  </Button>
                                  {activeTab === "revision" && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleEditAndResubmit(question.id)}
                                    >
                                      <Edit3 className="h-4 w-4 mr-1" />
                                      Edit & Resubmit
                                    </Button>
                                  )}
                                  {activeTab === "drafts" && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(question.id)}
                                      >
                                        <Edit3 className="h-4 w-4 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleSubmitForReview(question.id)}
                                      >
                                        <Send className="h-4 w-4 mr-1" />
                                        Submit
                                      </Button>
                                    </>
                                  )}
                                  {activeTab === "under-review" && (
                                    <Badge variant="outline" className="ml-2">
                                      Awaiting Review
                                    </Badge>
                                  )}
                                  {activeTab === "published" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEdit(question.id)}
                                    >
                                      <Edit3 className="h-4 w-4 mr-1" />
                                      Patch Edit
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* Reviewer Feedback Row */}
                            {showFeedback && !isCollapsed && (
                              <TableRow className="bg-muted/50 border-t">
                                <TableCell colSpan={getColSpan()} className="py-6 pl-6 pr-6">
                                  <div className="flex items-start gap-2">
                                    <div className="w-6 flex-shrink-0 flex justify-center">
                                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="text-sm font-semibold mb-2">
                                        Reviewer Feedback
                                      </h4>
                                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                        {question.reviewer_feedback}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
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
    </div>
  );
}
