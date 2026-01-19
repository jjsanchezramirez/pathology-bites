"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/shared/services/client";
import { useAuth } from "@/shared/hooks/use-auth";
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
import {
  Eye,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { QuestionPreviewDialog } from "./question-preview-dialog";
import { ReviewActionDialog } from "./review-action-dialog";
import { toast } from "@/shared/utils/toast";
import { formatDistanceToNow } from "date-fns";
import { DIFFICULTY_CONFIG, QuestionWithDetails } from "@/features/questions/types/questions";

// Category color mapping for better badge appearance - copied from questions-table.tsx
const getCategoryBadgeClass = (category: {
  short_form?: string | null;
  color?: string | null;
  parent_short_form?: string | null;
}) => {
  // If custom color is set, return empty string to use inline styles
  if (category.color) {
    return "";
  }

  // Fallback to predefined colors based on short form
  const shortForm = category.short_form || category.parent_short_form;

  // Main categories
  if (shortForm === "AP")
    return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
  if (shortForm === "CP")
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800";

  // AP subspecialties - stronger colors
  if (category.parent_short_form === "AP") {
    const colors = [
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
      "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800",
      "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800",
      "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800",
      "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800",
      "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/20 dark:text-lime-300 dark:border-lime-800",
    ];
    const hash = shortForm ? shortForm.split("").reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
    return colors[hash % colors.length];
  }

  // CP subspecialties - stronger colors
  if (category.parent_short_form === "CP") {
    const colors = [
      "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800",
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
      "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800",
      "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800",
    ];
    const hash = shortForm ? shortForm.split("").reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
    return colors[hash % colors.length];
  }

  // Default fallback
  return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800";
};

// Helper function to create standardized custom color styles
const getCustomColorStyle = (color: string | null | undefined) => {
  if (!color) return undefined;
  // Convert HSL to a lighter background version for consistency
  // Extract HSL values and create a light background with darker text
  const hslMatch = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (hslMatch) {
    const [, h, s] = hslMatch;
    return {
      backgroundColor: `hsl(${h} ${Math.min(parseInt(s), 50)}% 90%)`, // Light background
      color: `hsl(${h} ${s}% 20%)`, // Dark text
      borderColor: `hsl(${h} ${Math.min(parseInt(s), 60)}% 70%)`, // Medium border
    };
  }
  return undefined;
};

// Extended type for review queue with joined data
interface ReviewQuestionData {
  id: string;
  title: string;
  stem: string;
  difficulty: string;
  teaching_point: string;
  question_references: string | null;
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
  const [questions, setQuestions] = useState<ReviewQuestionData[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<ReviewQuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState<ReviewQuestionData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);

  const { user } = useAuth({ minimal: true });
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
          teaching_point,
          question_references,
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

      // Fetch resubmission notes from question_reviews for each question
      const questionsWithNotes = await Promise.all(
        (data || []).map(async (question) => {
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
            resubmission_notes: reviewData?.changes_made?.resubmission_notes || null,
          };
        })
      );

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

  const handlePreview = (question: ReviewQuestionData) => {
    setSelectedQuestion(question);
    setPreviewOpen(true);
  };

  const handleReviewAction = (question: ReviewQuestionData, action: "approve" | "reject") => {
    setSelectedQuestion(question);
    setReviewAction(action);
  };

  const handleReviewComplete = () => {
    setReviewAction(null);
    setSelectedQuestion(null);
    fetchReviewQueue(); // Refresh the queue
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
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading review queue...</p>
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

      {/* Search and Refresh */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchReviewQueue} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Questions Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {searchTerm
                    ? "No questions found matching your search"
                    : "No questions in your review queue"}
                </TableCell>
              </TableRow>
            ) : (
              filteredQuestions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center">
                        {question.title}
                        {getAgeIndicator(question.created_at)}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Submitted by <span className="font-medium">{question.creator_name}</span> •{" "}
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
                  <TableCell>
                    {question.categories?.id ? (
                      <Badge
                        variant="outline"
                        className={`${getCategoryBadgeClass(question.categories)}`}
                        style={getCustomColorStyle(question.categories.color)}
                      >
                        {question.category_short_form || question.category_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
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
