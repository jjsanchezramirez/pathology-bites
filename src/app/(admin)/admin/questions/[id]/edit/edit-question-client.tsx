"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/shared/utils/ui/toast";
import { AlertCircle, Send, ArrowLeft, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Form } from "@/shared/components/ui/form";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";

import { QuestionWithDetails } from "@/shared/types/questions";
import { useEditQuestionForm } from "@/features/admin/questions/hooks/use-edit-question-form";
import { EducationalContent } from "@/features/admin/questions/components/create/content-selector";

// Import tab components
import { TabNavigation } from "@/features/admin/questions/components/edit/tab-navigation";
import { SourceTab } from "@/features/admin/questions/components/edit/source-tab";
import { ContentTab } from "@/features/admin/questions/components/edit/content-tab";
import { ImagesTab } from "@/features/admin/questions/components/edit/images-tab";
import { MetadataTab } from "@/features/admin/questions/components/edit/metadata-tab";
import { SaveConfirmationDialog } from "@/features/admin/questions/components/edit/save-confirmation-dialog";
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
import { UserCheck } from "lucide-react";

interface EditQuestionClientProps {
  questionId: string;
}

export function EditQuestionClient({ questionId }: EditQuestionClientProps) {
  const router = useRouter();
  const [question, setQuestion] = useState<QuestionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("source");
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);
  const [showReviewerDialog, setShowReviewerDialog] = useState(false);
  const [_pendingChangeSummary, setPendingChangeSummary] = useState("");
  const [isPatchEditDisabled, setIsPatchEditDisabled] = useState(false);
  const [educationalContext, setEducationalContext] = useState<EducationalContent | null>(null);
  const [assignedReviewerId, setAssignedReviewerId] = useState<string | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
  const [reviewers, setReviewers] = useState<
    Array<{ id: string; name: string; full_name: string; pending_count: number }>
  >([]);
  const [loadingReviewers, setLoadingReviewers] = useState(false);
  const hasAutoAdvanced = useRef(false);
  const originalCorrectAnswerRef = useRef<string | null>(null);
  const originalImagesRef = useRef<
    import("@/shared/types/questions").QuestionImageFormData[]
  >([]);

  // Get return URL from query params, default to /admin/my-questions
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const returnUrl = searchParams.get("returnUrl") || "/admin/my-questions";

  // Fetch question data
  useEffect(() => {
    async function fetchQuestion() {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/questions/${questionId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          // Try to get error details from response
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `Failed to fetch question (${response.status})`;
          console.error("API Error:", errorData);
          throw new Error(errorMessage);
        }

        const data = await response.json();
        setQuestion(data.question);
        setAssignedReviewerId(data.question.reviewer_id || null);
      } catch (err) {
        console.error("Error fetching question:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load question";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchQuestion();
  }, [questionId]);

  // Auto-advance from Source tab to Content tab on initial load if all source fields are complete
  useEffect(() => {
    if (question && activeTab === "source" && !hasAutoAdvanced.current) {
      // Check if all source fields are complete
      const hasQuestionSet = !!question.question_set_id;
      const hasCategory = !!question.category_id;
      const hasLesson = !!question.lesson;
      const hasTopic = !!question.topic;

      // If all source information is present, auto-advance to Content tab
      if (hasQuestionSet && hasCategory && hasLesson && hasTopic) {
        hasAutoAdvanced.current = true;
        // Small delay to show the Source tab briefly before advancing
        setTimeout(() => {
          setActiveTab("content");
        }, 500);
      }
    }
  }, [question, activeTab]);

  // Load educational context when question has lesson/topic
  useEffect(() => {
    const loadEducationalContext = async () => {
      if (!question?.lesson || !question?.topic) {
        return;
      }

      try {
        // Import the loadContentFromR2 function
        const { loadContentFromR2, CONTENT_FILES } =
          await import("@/features/admin/questions/components/create/content-selector");

        // Find the appropriate content file based on the question's subject
        const subjectName = question.category?.name;
        const contentFile = CONTENT_FILES.find((file) => file.subject === subjectName);

        if (contentFile) {
          const contextData = await loadContentFromR2(contentFile.filename);
          if (contextData) {
            // Extract the specific topic content
            const lesson = contextData.subject.lessons[question.lesson];
            const topic = lesson?.topics[question.topic];

            if (topic?.content) {
              setEducationalContext({
                category: contextData.category,
                subject: contextData.subject.name,
                lesson: question.lesson,
                topic: question.topic,
                content: topic.content,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error loading educational context:", error);
      }
    };

    loadEducationalContext();
  }, [question]);

  // Use the edit question form hook
  const skipNavigationRef = useRef(false);

  const {
    form,
    isSubmitting,
    hasUnsavedChanges,
    selectedTagIds,
    answerOptions,
    questionImages,
    isPatchEdit,
    patchEditReason: _patchEditReason,
    setSelectedTagIds,
    setAnswerOptions,
    setQuestionImages,
    setIsPatchEdit,
    setPatchEditReason,
    setReviewerId,
    handleSubmit,
    handleUnsavedChanges,
  } = useEditQuestionForm({
    question: question || undefined,
    open: !!question,
    onSave: () => {
      toast.success("Question updated successfully!");

      // Dispatch event to update sidebar immediately
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("questionStatusChanged"));
      }

      // If we just assigned a reviewer, wait for sidebar to update before navigating
      if (skipNavigationRef.current) {
        skipNavigationRef.current = false;
        // Refresh and wait before navigating
        router.refresh();
        setTimeout(() => {
          router.replace(returnUrl);
        }, 700);
      } else {
        // Normal flow - navigate immediately
        router.replace(returnUrl);
        router.refresh();
      }
    },
    onClose: () => {
      router.push(returnUrl);
    },
  });

  // Store original correct answer and images when question loads
  useEffect(() => {
    if (question && originalCorrectAnswerRef.current === null) {
      // Find the correct answer ID (only set once on initial load)
      const correctOption = question.question_options?.find(
        (opt: { is_correct: boolean; id: string }) => opt.is_correct
      );
      originalCorrectAnswerRef.current = correctOption?.id || null;
    }
  }, [question]);

  useEffect(() => {
    if (questionImages.length > 0 && originalImagesRef.current.length === 0) {
      // Store original images (only set once on initial load)
      originalImagesRef.current = questionImages;
    }
  }, [questionImages]);

  // Check if correct answer or images changed - disable patch edit if so
  useEffect(() => {
    if (!question || originalCorrectAnswerRef.current === null) return;

    // Check if correct answer changed
    const currentCorrectOption = answerOptions?.find((opt) => opt.is_correct);
    const correctAnswerChanged = currentCorrectOption?.id !== originalCorrectAnswerRef.current;

    // Check if images changed (only if we have original images to compare)
    let imagesChanged = false;
    if (originalImagesRef.current.length > 0 || questionImages.length > 0) {
      imagesChanged =
        questionImages.length !== originalImagesRef.current.length ||
        questionImages.some(
          (img, idx) =>
            !originalImagesRef.current[idx] ||
            img.image_id !== originalImagesRef.current[idx].image_id
        );
    }

    const shouldDisablePatch = correctAnswerChanged || imagesChanged;

    // Only auto-switch if currently on patch AND it should be disabled
    const currentUpdateType = form.getValues("updateType");
    if (shouldDisablePatch && currentUpdateType === "patch") {
      // Automatically switch to minor edit
      setIsPatchEdit(false);
      form.setValue("updateType", "minor", { shouldDirty: true });
    }

    setIsPatchEditDisabled(shouldDisablePatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerOptions, questionImages, question]);

  // Handle cancel
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
        router.push(returnUrl);
      }
    } else {
      router.push(returnUrl);
    }
  };

  // Handle save button click - show confirmation dialog for published questions
  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();

    // For published questions, show the confirmation dialog
    if (question?.status === "published") {
      setShowSaveConfirmDialog(true);
    } else {
      // For non-published questions, submit directly
      form.handleSubmit((data) => handleSubmit(data))();
    }
  };

  // Handle save confirmation from dialog
  const handleSaveConfirmation = async (changeSummary: string) => {
    setPendingChangeSummary(changeSummary);

    // Set the change summary in the form if provided
    if (changeSummary.trim()) {
      // Always set in form to avoid race conditions
      form.setValue("changeSummary", changeSummary);
      // Also set patch edit reason state for backwards compatibility
      if (isPatchEdit) {
        setPatchEditReason(changeSummary);
      }
    }

    setShowSaveConfirmDialog(false);

    // For minor/major edits on published questions, check if reviewer is assigned
    const updateType = form.getValues("updateType");
    if (
      question?.status === "published" &&
      !isPatchEdit &&
      ["minor", "major"].includes(updateType || "") &&
      !assignedReviewerId
    ) {
      // Need to assign a reviewer first
      setShowReviewerDialog(true);
      return;
    }

    // Submit the form
    try {
      await form.handleSubmit((data) => handleSubmit(data))();
    } catch (error) {
      // Error is already displayed in toast by useEditQuestionForm
      console.error("Save confirmation error:", error);
    }
  };

  // Fetch reviewers when dialog opens
  useEffect(() => {
    if (showReviewerDialog) {
      const fetchReviewers = async () => {
        setLoadingReviewers(true);
        try {
          const response = await fetch("/api/admin/questions/reviewers");
          if (!response.ok) throw new Error("Failed to fetch reviewers");
          const data = await response.json();
          setReviewers(data.reviewers || []);
        } catch (error) {
          console.error("Error fetching reviewers:", error);
          toast.error("Failed to load reviewers");
        } finally {
          setLoadingReviewers(false);
        }
      };
      fetchReviewers();
    }
  }, [showReviewerDialog]);

  // Handle reviewer assignment - just store the ID, don't call API yet
  const handleReviewerSelection = async () => {
    if (!selectedReviewerId) {
      toast.error("Please select a reviewer");
      return;
    }

    setShowReviewerDialog(false);
    setAssignedReviewerId(selectedReviewerId);
    setReviewerId(selectedReviewerId);

    // Set flag to delay navigation and allow sidebar to update
    skipNavigationRef.current = true;

    // Now proceed with saving the question with the assigned reviewer
    // Pass reviewer ID directly to avoid async state update issues
    try {
      await form.handleSubmit((data) => handleSubmit(data, selectedReviewerId))();
    } catch (error) {
      console.error("Save after reviewer assignment error:", error);
      skipNavigationRef.current = false; // Reset flag on error
    }
  };

  // Handle save and submit for review
  const handleSaveAndSubmit = async () => {
    try {
      // Set status to pending_review
      form.setValue("status", "pending_review");

      // Submit the form (the onSave callback will handle toast and navigation)
      await form.handleSubmit((data) => handleSubmit(data))();
    } catch (error) {
      console.error("Save and submit error:", error);
      toast.error("Failed to save and submit question");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Status Badge Skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 w-32" />
        </div>

        {/* Tab Navigation Skeleton */}
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/50 px-6 py-3">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>

          {/* Form Content Skeleton */}
          <div className="p-6 space-y-6">
            {/* Question Title */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Question Stem */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-32 w-full" />
            </div>

            {/* Options */}
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !question) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Question not found"}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push(returnUrl)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  // Get reviewer feedback if question was flagged or rejected
  const reviewerFeedback =
    question.status === "flagged" || question.status === "rejected"
      ? question.reviewer_feedback
      : null;

  // Get context for banner
  const getContextBanner = () => {
    // Don't show context banner for rejected questions - feedback is shown separately
    if (question.status === "draft") {
      return {
        variant: "default" as const,
        title: "Editing Draft",
        description: "This question has not been submitted for review yet.",
      };
    }
    if (question.status === "published") {
      return {
        variant: "default" as const,
        title: "Patch Editing Published Question",
        description:
          "Making changes to a published question. Select the appropriate edit type below.",
      };
    }
    if (question.status === "pending_review") {
      return {
        variant: "default" as const,
        title: "Editing Question Under Review",
        description:
          "This question is currently being reviewed. Changes will require resubmission.",
      };
    }
    return null;
  };

  const contextBanner = getContextBanner();

  return (
    <div className="space-y-6">
      {/* Context Banner */}
      {contextBanner && (
        <Alert variant={contextBanner.variant}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">{contextBanner.title}</p>
              <p className="text-sm">{contextBanner.description}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Reviewer Feedback Alert */}
      {reviewerFeedback && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">Reviewer Feedback:</p>
              <p className="text-sm whitespace-pre-wrap">{reviewerFeedback}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Form */}
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit((data) => handleSubmit(data))(e);
          }}
          className="space-y-6"
        >
          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content */}
          <div>
            {activeTab === "source" && (
              <SourceTab
                question={question}
                form={form}
                onUnsavedChanges={handleUnsavedChanges}
                onEducationalContextChange={setEducationalContext}
              />
            )}
            {activeTab === "content" && (
              <ContentTab
                form={form}
                question={question}
                onUnsavedChanges={handleUnsavedChanges}
                answerOptions={answerOptions}
                onAnswerOptionsChange={setAnswerOptions}
                educationalContext={educationalContext}
              />
            )}
            {activeTab === "images" && (
              <ImagesTab
                question={question}
                onUnsavedChanges={handleUnsavedChanges}
                questionImages={questionImages}
                onQuestionImagesChange={setQuestionImages}
              />
            )}
            {activeTab === "metadata" && (
              <MetadataTab
                form={form}
                question={question}
                onUnsavedChanges={handleUnsavedChanges}
                selectedTagIds={selectedTagIds}
                onTagsChange={setSelectedTagIds}
              />
            )}
          </div>

          {/* Edit Type Card for Published Questions */}
          {question.status === "published" && (
            <Card className="p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Edit Type</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select the type of changes you're making to this published question
                  </p>
                </div>
                <RadioGroup
                  value={form.watch("updateType") || "patch"}
                  onValueChange={(value: "patch" | "minor" | "major") => {
                    if (value === "patch" && isPatchEditDisabled) {
                      return; // Don't allow patch if disabled
                    }
                    setIsPatchEdit(value === "patch");
                    form.setValue("updateType", value, { shouldDirty: true });
                    handleUnsavedChanges();
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="patch" id="patch" disabled={isPatchEditDisabled} />
                    <Label
                      htmlFor="patch"
                      className={`font-normal cursor-pointer ${isPatchEditDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      Patch{" "}
                      <span className="text-xs text-muted-foreground">(typos, formatting)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="minor" id="minor" />
                    <Label htmlFor="minor" className="font-normal cursor-pointer">
                      Minor <span className="text-xs text-muted-foreground">(content changes)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="major" id="major" />
                    <Label htmlFor="major" className="font-normal cursor-pointer">
                      Major{" "}
                      <span className="text-xs text-muted-foreground">
                        (answer change, overhaul)
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
                {isPatchEditDisabled && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
                    ⚠️ Patch edit is disabled because you've changed the correct answer or modified
                    images. These changes require review.
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Footer with Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancel
            </Button>

            <div className="flex gap-3">
              {question.status !== "published" && question.status !== "pending_review" && (
                <Button
                  type="button"
                  onClick={handleSaveAndSubmit}
                  disabled={isSubmitting || !hasUnsavedChanges}
                  variant="outline"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Save & Submit for Review
                </Button>
              )}

              <Button
                type="submit"
                onClick={handleSaveClick}
                disabled={isSubmitting || !hasUnsavedChanges}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : !hasUnsavedChanges ? (
                  "No Changes"
                ) : question.status === "published" ? (
                  "Publish Changes"
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>

      {/* Save Confirmation Dialog */}
      {question?.status === "published" && (
        <SaveConfirmationDialog
          open={showSaveConfirmDialog}
          onOpenChange={setShowSaveConfirmDialog}
          editType={
            isPatchEdit ? "patch" : (form.getValues("updateType") as "minor" | "major") || "minor"
          }
          onConfirm={handleSaveConfirmation}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Reviewer Assignment Dialog */}
      <Dialog open={showReviewerDialog} onOpenChange={setShowReviewerDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Reviewer</DialogTitle>
            <DialogDescription>
              This {form.getValues("updateType")} edit requires review. Please select a reviewer to
              evaluate these changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reviewer">Select Reviewer</Label>
              {loadingReviewers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                  <SelectTrigger id="reviewer">
                    <SelectValue placeholder="Select a reviewer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {reviewers.map((reviewer) => (
                      <SelectItem key={reviewer.id} value={reviewer.id}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4" />
                            <span>{reviewer.full_name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground ml-4">
                            {reviewer.pending_count} pending
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {reviewers.length === 0 && !loadingReviewers && (
                <p className="text-sm text-muted-foreground">No reviewers available</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewerDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReviewerSelection}
              disabled={!selectedReviewerId || loadingReviewers}
            >
              Assign & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
