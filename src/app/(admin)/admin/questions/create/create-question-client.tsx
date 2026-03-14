"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/shared/utils/ui/toast";
import { MultiStepQuestionForm } from "@/features/admin/questions/components/create/multi-step-question-form";
import { QuestionFormData } from "@/shared/types/questions";
import { apiClient } from "@/shared/utils/api/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Loader2 } from "lucide-react";

export function CreateQuestionClient() {
  const router = useRouter();
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateData, setDuplicateData] = useState<{
    existingQuestions: Array<{ id: string; title: string }>;
    pendingQuestionData: QuestionFormData;
  } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Handle form submission
  const handleSubmit = async (data: QuestionFormData, allowDuplicate = false) => {
    try {
      const response = await apiClient.post("/api/admin/questions/create", {
        ...data,
        allowDuplicate,
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Check if it's a duplicate topic error
        if (response.status === 409 && errorData.error === "DUPLICATE_TOPIC") {
          setDuplicateData({
            existingQuestions: errorData.existingQuestions || [],
            pendingQuestionData: data,
          });
          setShowDuplicateDialog(true);
          return; // Don't show error toast, show dialog instead
        }

        throw new Error(errorData.error || "Failed to create question");
      }

      toast.success("Question created successfully!");
      router.push("/admin/questions");
      router.refresh();
    } catch (error) {
      console.error("Error creating question:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create question");
      throw error; // Re-throw to let the form handle it
    }
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateData) return;

    setIsRetrying(true);
    try {
      await handleSubmit(duplicateData.pendingQuestionData, true);
      setShowDuplicateDialog(false);
      setDuplicateData(null);
    } catch (_error) {
      // Error already handled by handleSubmit
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/questions");
  };

  return (
    <>
      <div className="space-y-6">
        <MultiStepQuestionForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>

      {/* Duplicate Topic Confirmation Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Duplicate Topic Detected</DialogTitle>
              <DialogDescription>
                A question with this topic combination already exists. Are you sure you want to
                create another question with the same topic?
              </DialogDescription>
            </DialogHeader>

            {duplicateData && duplicateData.existingQuestions.length > 0 && (
              <div className="my-4">
                <p className="text-sm font-medium mb-2">Existing questions:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {duplicateData.existingQuestions.map((q) => (
                    <div key={q.id} className="text-sm p-2 bg-muted rounded border border-border">
                      {q.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDuplicateDialog(false);
                  setDuplicateData(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmDuplicate} disabled={isRetrying}>
                {isRetrying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Anyway"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
