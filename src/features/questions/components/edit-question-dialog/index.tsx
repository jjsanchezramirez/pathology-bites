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
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Loader2, Brain, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
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
  onSuccess: () => void;
}

export function EditQuestionDialog({
  question,
  open,
  onOpenChange,
  onSuccess
}: EditQuestionDialogProps) {
  // State
  const [activeTab, setActiveTab] = useState('content');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isRefining, setIsRefining] = useState(false);

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
    onSave: onSuccess,
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

  // Handle AI refinement
  const handleAIRefinement = async () => {
    if (!chatMessage.trim()) {
      toast.error('Please enter a refinement request');
      return;
    }

    setIsRefining(true);
    try {
      const currentFormData = form.getValues();

      const requestBody = {
        mode: 'refinement',
        instructions: chatMessage,
        currentQuestion: {
          title: currentFormData.title,
          stem: currentFormData.stem,
          answer_options: answerOptions,
          teaching_point: currentFormData.teaching_point,
          question_references: currentFormData.question_references
        },
        model: 'Llama-3.3-8B-Instruct' // Use fast model for refinements
      };

      const response = await fetch('/api/admin/ai-generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to refine question`);
      }

      const data = await response.json();

      // Check if we got valid data back
      if (!data || (!data.stem && !data.title)) {
        throw new Error('Invalid response from AI service');
      }

      // Update form with refined content
      if (data.title) {
        form.setValue('title', data.title);
      }
      if (data.stem) {
        form.setValue('stem', data.stem);
      }
      if (data.teaching_point) {
        form.setValue('teaching_point', data.teaching_point);
      }
      if (data.question_references) {
        form.setValue('question_references', data.question_references);
      }

      // Update answer options if provided
      if (data.answer_options && Array.isArray(data.answer_options)) {
        const updatedOptions = data.answer_options.map((option: any, index: number) => ({
          text: option.text || '',
          is_correct: option.is_correct || false,
          explanation: option.explanation || '',
          order_index: index
        }));
        setAnswerOptions(updatedOptions);
      }

      handleUnsavedChanges();
      toast.success('Question refined successfully!');
      setChatMessage('');
    } catch (error) {
      console.error('AI refinement error:', error);
      toast.error(`Failed to refine question: ${error.message}`);
    } finally {
      setIsRefining(false);
    }
  };

  // Handle save and submit for review
  const handleSaveAndSubmit = async () => {
    try {
      // First save the question
      await form.handleSubmit(handleSubmit)();

      // Then submit for review
      // We'll need to implement this logic
      toast.info('Save and submit functionality coming soon');
    } catch (error) {
      console.error('Save and submit error:', error);
      toast.error('Failed to save and submit question');
    }
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

                {/* AI Refinement Section */}
                <div className="flex-shrink-0 px-6 py-4 border-t bg-muted/30">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Refine Question with AI
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Request Changes</Label>
                        <Textarea
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Ask AI to modify specific parts of the question (e.g., 'Make the question more challenging', 'Add more clinical context', 'Improve the distractors')"
                          rows={3}
                        />
                      </div>
                      <Button
                        onClick={handleAIRefinement}
                        disabled={!chatMessage.trim() || isRefining}
                        className="w-full"
                        type="button"
                      >
                        {isRefining ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Refining...
                          </>
                        ) : (
                          <>
                            <Brain className="mr-2 h-4 w-4" />
                            Refine Question
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
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
                      variant="outline"
                      disabled={isSubmitting || !hasUnsavedChanges}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        hasUnsavedChanges ? 'Save' : 'No Changes'
                      )}
                    </Button>
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
                          Save & Send for Review
                        </>
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
