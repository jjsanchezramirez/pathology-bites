// src/features/questions/components/flagged-questions-table.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/services/client";
import { toast } from "@/shared/utils/toast";
import { formatDistanceToNow } from "date-fns";
import {
  QuestionWithDetails,
  QuestionFlagData,
  FLAG_TYPE_CONFIG,
  STATUS_CONFIG,
} from "@/features/questions/types/questions";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  AlertTriangle,
  Check,
  X,
  Flag,
  MoreHorizontal,
  Eye,
  Archive,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export function FlaggedQuestionsTable() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuthContext();
  const [questions, setQuestions] = useState<QuestionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithDetails | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [flagDetails, setFlagDetails] = useState<QuestionFlagData | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolution, setResolution] = useState<string>("");
  const [reviewerNotes, setReviewerNotes] = useState<string>("");

  const fetchFlaggedQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("questions")
        .select(
          `
          *,
          categories(*),
          question_flags(*),
          question_options(*),
          question_images(*)
        `
        )
        .in("status", ["flagged", "needs_revision"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const questionsData = (data || []).map((question: Record<string, unknown>) => ({
        ...question,
        question_flags: Array.isArray(question.question_flags)
          ? question.question_flags.filter((flag: unknown) => flag !== null)
          : [],
      })) as QuestionWithDetails[];

      setQuestions(questionsData);
    } catch (error) {
      console.error("Error fetching flagged questions:", error);
      toast.error("Failed to load flagged questions");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchFlaggedQuestions();
  }, [fetchFlaggedQuestions]);

  const loadFlagDetails = useCallback(
    async (questionId: string) => {
      try {
        const { data, error } = await supabase
          .from("question_flags")
          .select("*")
          .eq("question_id", questionId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setFlagDetails(data[0] as QuestionFlagData);
        }
      } catch (error) {
        console.error("Error loading flag details:", error);
      }
    },
    [supabase]
  );

  const handleViewQuestion = async (question: QuestionWithDetails) => {
    setSelectedQuestion(question);
    await loadFlagDetails(question.id);
  };

  const handleResolveFlag = async () => {
    if (!selectedQuestion || !resolution) return;

    try {
      setActionLoading(true);

      // Update question status
      const { error: updateError } = await supabase
        .from("questions")
        .update({
          status: resolution,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedQuestion.id);

      if (updateError) throw updateError;

      // Update flag status
      if (flagDetails) {
        const { error: flagError } = await supabase
          .from("question_flags")
          .update({
            resolved: true,
            resolved_by: user?.id,
            resolved_at: new Date().toISOString(),
            resolution,
            reviewer_notes: reviewerNotes,
          })
          .eq("id", flagDetails.id);

        if (flagError) throw flagError;
      }

      toast.success("Flag resolved successfully");
      setShowResolveDialog(false);
      setSelectedQuestion(null);
      setFlagDetails(null);
      setResolution("");
      setReviewerNotes("");
      fetchFlaggedQuestions();
    } catch (error) {
      console.error("Error resolving flag:", error);
      toast.error("Failed to resolve flag");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissFlag = async (questionId: string) => {
    try {
      setActionLoading(true);

      const { error } = await supabase
        .from("question_flags")
        .update({ dismissed: true })
        .eq("question_id", questionId);

      if (error) throw error;

      toast.success("Flag dismissed");
      fetchFlaggedQuestions();
    } catch (error) {
      console.error("Error dismissing flag:", error);
      toast.error("Failed to dismiss flag");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveQuestion = async (questionId: string) => {
    try {
      setActionLoading(true);

      const { error } = await supabase
        .from("questions")
        .update({
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId);

      if (error) throw error;

      toast.success("Question archived");
      fetchFlaggedQuestions();
    } catch (error) {
      console.error("Error archiving question:", error);
      toast.error("Failed to archive question");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    return config?.color || "bg-gray-100 text-gray-800";
  };

  const getFlagTypeColor = (flagType: string) => {
    const config = FLAG_TYPE_CONFIG[flagType as keyof typeof FLAG_TYPE_CONFIG];
    return config?.color || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flagged Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flagged Questions ({questions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>No flagged questions at this time</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={getStatusColor(question.status)}>
                          {STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.label ||
                            question.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <h4 className="font-medium truncate">
                        {question.stem_text || "Untitled Question"}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {question.categories?.map((c) => c.name).join(", ") || "Uncategorized"}
                      </p>
                      {question.question_flags && question.question_flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {question.question_flags.slice(0, 3).map((flag, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className={`text-xs ${getFlagTypeColor(flag.flag_type)}`}
                            >
                              {FLAG_TYPE_CONFIG[flag.flag_type as keyof typeof FLAG_TYPE_CONFIG]
                                ?.label || flag.flag_type}
                            </Badge>
                          ))}
                          {question.question_flags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{question.question_flags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewQuestion(question)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDismissFlag(question.id)}>
                            <X className="h-4 w-4 mr-2" />
                            Dismiss Flag
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchiveQuestion(question.id)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive Question
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/questions/${question.id}/edit`)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Edit Question
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Question Review Dialog */}
      <Dialog open={!!selectedQuestion} onOpenChange={() => setSelectedQuestion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Flagged Question</DialogTitle>
            <DialogDescription>Review the question and resolve the flag</DialogDescription>
          </DialogHeader>
          {selectedQuestion && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getStatusColor(selectedQuestion.status)}>
                  {STATUS_CONFIG[selectedQuestion.status as keyof typeof STATUS_CONFIG]?.label ||
                    selectedQuestion.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Created{" "}
                  {formatDistanceToNow(new Date(selectedQuestion.created_at), { addSuffix: true })}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Question Stem</h4>
                  <p className="p-3 bg-muted rounded-lg">{selectedQuestion.stem_text}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Answer Options</h4>
                  <div className="space-y-2">
                    {selectedQuestion.question_options?.map((option, idx) => (
                      <div
                        key={option.id}
                        className={`p-3 rounded-lg ${
                          option.is_correct ? "bg-green-50 border border-green-200" : "bg-muted"
                        }`}
                      >
                        <span className="font-medium">{String.fromCharCode(65 + idx)}.</span>{" "}
                        {option.text}
                        {option.explanation && (
                          <p className="text-sm text-muted-foreground mt-1">{option.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedQuestion.explanation && (
                  <div>
                    <h4 className="font-medium mb-2">Explanation</h4>
                    <p className="p-3 bg-muted rounded-lg">{selectedQuestion.explanation}</p>
                  </div>
                )}

                {flagDetails && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Flag className="h-4 w-4 text-amber-500" />
                      Flag Details
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={getFlagTypeColor(flagDetails.flag_type)}
                        >
                          {FLAG_TYPE_CONFIG[flagDetails.flag_type as keyof typeof FLAG_TYPE_CONFIG]
                            ?.label || flagDetails.flag_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Reported{" "}
                          {formatDistanceToNow(new Date(flagDetails.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {flagDetails.description && (
                        <p className="text-sm">{flagDetails.description}</p>
                      )}
                      {flagDetails.reporter_id && (
                        <p className="text-xs text-muted-foreground">
                          Reporter ID: {flagDetails.reporter_id}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedQuestion(null)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowResolveDialog(true);
                    setResolution("needs_revision");
                  }}
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Request Revision
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    setShowResolveDialog(true);
                    setResolution("approved");
                  }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Flag Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Flag</DialogTitle>
            <DialogDescription>Choose how to resolve this flag</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution</label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Approve - Question is correct</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="needs_revision">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-amber-500" />
                      <span>Needs Revision - Author should update</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-500" />
                      <span>Reject - Question has issues</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reviewer Notes (optional)</label>
              <textarea
                className="w-full p-3 border rounded-lg resize-none"
                rows={3}
                placeholder="Add notes for the author..."
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleResolveFlag}
              disabled={!resolution || actionLoading}
            >
              {actionLoading ? "Resolving..." : "Resolve Flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
