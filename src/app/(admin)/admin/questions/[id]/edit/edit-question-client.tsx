"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/shared/utils/toast";
import { AlertCircle, Send, ArrowLeft, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Form } from "@/shared/components/ui/form";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { QuestionWithDetails } from "@/features/questions/types/questions";
import { useEditQuestionForm } from "@/features/questions/hooks/use-edit-question-form";

// Import tab components
import { TabNavigation } from "./tab-navigation";
import { SourceTab } from "./source-tab";
import { ContentTab } from "./content-tab";
import { ImagesTab } from "./images-tab";
import { MetadataTab } from "./metadata-tab";

interface EditQuestionClientProps {
  questionId: string;
}

export function EditQuestionClient({ questionId }: EditQuestionClientProps) {
  const router = useRouter();
  const [question, setQuestion] = useState<QuestionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("source");
  const hasAutoAdvanced = useRef(false);

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

  // Use the edit question form hook
  const {
    form,
    isSubmitting,
    hasUnsavedChanges,
    selectedTagIds,
    answerOptions,
    questionImages,
    isPatchEdit,
    patchEditReason,
    setSelectedTagIds,
    setAnswerOptions,
    setQuestionImages,
    setIsPatchEdit,
    setPatchEditReason,
    handleSubmit,
    handleUnsavedChanges,
  } = useEditQuestionForm({
    question: question || undefined,
    open: !!question,
    onSave: () => {
      toast.success("Question updated successfully!");
      // Use replace instead of push to avoid adding to history
      // Then refresh to force data reload
      router.replace(returnUrl);
      router.refresh();
    },
    onClose: () => {
      router.push(returnUrl);
    },
  });

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

  // Handle save and submit for review
  const handleSaveAndSubmit = async () => {
    try {
      // Set status to pending_review
      form.setValue("status", "pending_review");

      // Submit the form (the onSave callback will handle toast and navigation)
      await form.handleSubmit(handleSubmit)();
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
    if (question.status === "rejected" && reviewerFeedback) {
      return {
        variant: "destructive" as const,
        title: "Revising Rejected Question",
        description: "This question was rejected by a reviewer. Address the feedback below before resubmitting.",
      };
    }
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
        description: "Making changes to a published question. Select the appropriate edit type below.",
      };
    }
    if (question.status === "pending_review") {
      return {
        variant: "default" as const,
        title: "Editing Question Under Review",
        description: "This question is currently being reviewed. Changes will require resubmission.",
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
        <Alert variant="destructive">
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
            form.handleSubmit(handleSubmit)(e);
          }}
          className="space-y-6"
        >
          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content */}
          <div>
            {activeTab === "source" && <SourceTab question={question} />}
            {activeTab === "content" && (
              <ContentTab
                form={form}
                question={question}
                onUnsavedChanges={handleUnsavedChanges}
                answerOptions={answerOptions}
                onAnswerOptionsChange={setAnswerOptions}
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

          {/* Edit Type Selection for Published Questions */}
          {question.status === "published" && (
            <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Edit Type</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Select the type of edit you're making to this published question.
                  </p>
                </div>

                <div className="space-y-2">
                  {/* Patch Edit Option */}
                  <div
                    className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setIsPatchEdit(true);
                      form.setValue("updateType", "patch");
                      handleUnsavedChanges();
                    }}
                  >
                    <input
                      type="radio"
                      id="editType-patch"
                      name="editType"
                      checked={isPatchEdit}
                      onChange={() => {
                        setIsPatchEdit(true);
                        form.setValue("updateType", "patch");
                        handleUnsavedChanges();
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="editType-patch"
                        className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer"
                      >
                        Patch Edit (No Review Needed)
                      </label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Typos, formatting, metadata only. Version: 1.0.x
                      </p>
                    </div>
                  </div>

                  {/* Minor Edit Option */}
                  <div
                    className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setIsPatchEdit(false);
                      form.setValue("updateType", "minor");
                      handleUnsavedChanges();
                    }}
                  >
                    <input
                      type="radio"
                      id="editType-minor"
                      name="editType"
                      checked={!isPatchEdit && form.getValues("updateType") === "minor"}
                      onChange={() => {
                        setIsPatchEdit(false);
                        form.setValue("updateType", "minor");
                        handleUnsavedChanges();
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="editType-minor"
                        className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer"
                      >
                        Minor Edit (Requires Review)
                      </label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Content changes (stem, options, explanations, teaching point). Version:
                        1.x.0
                      </p>
                    </div>
                  </div>

                  {/* Major Edit Option */}
                  <div
                    className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setIsPatchEdit(false);
                      form.setValue("updateType", "major");
                      handleUnsavedChanges();
                    }}
                  >
                    <input
                      type="radio"
                      id="editType-major"
                      name="editType"
                      checked={!isPatchEdit && form.getValues("updateType") === "major"}
                      onChange={() => {
                        setIsPatchEdit(false);
                        form.setValue("updateType", "major");
                        handleUnsavedChanges();
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="editType-major"
                        className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer"
                      >
                        Major Edit (Requires Review)
                      </label>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Question overhaul or answer change. Version: x.0.0
                      </p>
                    </div>
                  </div>
                </div>

                {isPatchEdit && (
                  <div>
                    <label
                      htmlFor="patchEditReason"
                      className="text-xs font-medium text-blue-900 dark:text-blue-100"
                    >
                      Reason for patch edit (optional)
                    </label>
                    <textarea
                      id="patchEditReason"
                      value={patchEditReason}
                      onChange={(e) => {
                        setPatchEditReason(e.target.value);
                        handleUnsavedChanges();
                      }}
                      placeholder="e.g., Fixed typo in question stem"
                      className="mt-1 w-full text-xs p-2 border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-blue-950/50 text-foreground"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cancel
            </Button>

            <div className="flex gap-3">
              <Button type="submit" variant="outline" disabled={isSubmitting || !hasUnsavedChanges}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : hasUnsavedChanges ? (
                  "Save Changes"
                ) : (
                  "No Changes"
                )}
              </Button>

              {question.status !== "published" && question.status !== "pending_review" && (
                <Button
                  type="button"
                  onClick={handleSaveAndSubmit}
                  disabled={isSubmitting || !hasUnsavedChanges}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving & Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Save & Submit for Review
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
