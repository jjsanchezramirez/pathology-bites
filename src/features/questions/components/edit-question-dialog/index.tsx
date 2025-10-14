'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Form } from "@/shared/components/ui/form";
import { Button } from "@/shared/components/ui/button";
import { Loader2 } from 'lucide-react';
import { QuestionWithDetails } from '@/features/questions/types/questions';
import { useEditQuestionForm, EditQuestionFormData } from '@/features/questions/hooks/use-edit-question-form';

// Components
import { ContentTab } from './content-tab';
import { ImagesTab } from './images-tab';
import { MetadataTab } from './metadata-tab';
import { TabNavigation } from './tab-navigation';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { QuestionMetadata } from './question-metadata';

interface EditQuestionDialogProps {
  question: QuestionWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EditQuestionDialog({
  question,
  open,
  onOpenChange,
  onSave
}: EditQuestionDialogProps) {
  // State
  const [activeTab, setActiveTab] = useState('content');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Use the custom hook for form management
  const {
    form,
    isSubmitting,
    hasUnsavedChanges,
    selectedTagIds,
    answerOptions,
    questionImages,
    setSelectedTagIds,
    setAnswerOptions,
    setQuestionImages,
    handleSubmit,
    handleUnsavedChanges,
  } = useEditQuestionForm({
    question: question || undefined,
    open,
    onSave,
    onClose: () => onOpenChange(false),
  });

  // Handle dialog close with unsaved changes check
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      onOpenChange(newOpen);
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  if (!question) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="w-full !max-w-6xl h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
              <DialogTitle>Edit Question</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full min-h-0">
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex-shrink-0 px-6">
                    <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {activeTab === 'content' && (
                      <ContentTab
                        form={form}
                        question={question}
                        onUnsavedChanges={handleUnsavedChanges}
                        answerOptions={answerOptions}
                        onAnswerOptionsChange={setAnswerOptions}
                      />
                    )}
                    {activeTab === 'images' && (
                      <ImagesTab
                        question={question}
                        onUnsavedChanges={handleUnsavedChanges}
                        questionImages={questionImages}
                        onQuestionImagesChange={setQuestionImages}
                      />
                    )}
                    {activeTab === 'metadata' && (
                      <MetadataTab
                        form={form}
                        question={question}
                        onUnsavedChanges={handleUnsavedChanges}
                        selectedTagIds={selectedTagIds}
                        onTagsChange={setSelectedTagIds}
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center gap-3 px-6 py-4 flex-shrink-0 border-t bg-background">
                  <QuestionMetadata question={question} />

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || !hasUnsavedChanges}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        hasUnsavedChanges ? 'Update Question' : 'No Changes'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <UnsavedChangesDialog
        open={showConfirmDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
}
