'use client';

import React, { useState, useEffect } from 'react';
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
import { QuestionWithDetails, TagData } from '@/features/questions/types/questions';
import { useEditQuestionForm, EditQuestionFormData } from '@/features/questions/hooks/use-edit-question-form';
import { createClient } from '@/shared/services/client';

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
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);

  // Use the custom hook for form management
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

  // Load available tags for AI tag matching
  useEffect(() => {
    const loadTags = async () => {
      try {
        const supabase = createClient();
        const { data: tagsData } = await supabase
          .from('tags')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100); // Load more tags for better matching

        if (tagsData) {
          setAvailableTags(tagsData);
        }
      } catch (error) {
        console.error('Error loading tags:', error);
      }
    };

    if (open) {
      loadTags();
    }
  }, [open]);



  // Get AI model from question set
  const getAIModelFromQuestionSet = () => {
    if (question?.set?.source_type === 'ai_generated' && question?.set?.source_details) {
      const sourceDetails = question.set.source_details as any;
      return sourceDetails.primary_model || 'Llama-3.3-8B-Instruct';
    }
    return 'Llama-3.3-8B-Instruct'; // Default fast model for refinements
  };

  // Handle AI suggested tags - match existing or create new ones
  const handleAISuggestedTags = async (suggestedTagNames: string[]) => {
    try {
      const supabase = createClient();
      const newTagIds: string[] = [];
      const addedTagNames: string[] = [];

      for (const tagName of suggestedTagNames) {
        const normalizedTagName = tagName.trim().toLowerCase();

        // Try to find existing tag (case-insensitive)
        const existingTag = availableTags.find(tag =>
          tag.name.toLowerCase() === normalizedTagName
        );

        if (existingTag) {
          // Use existing tag if not already selected
          if (!selectedTagIds.includes(existingTag.id)) {
            newTagIds.push(existingTag.id);
            addedTagNames.push(existingTag.name);
          }
        } else {
          // Create new tag
          const { data: newTag, error } = await supabase
            .from('tags')
            .insert([{ name: tagName.trim() }])
            .select()
            .single();

          if (error) {
            console.error('Error creating tag:', error);
            continue;
          }

          if (newTag) {
            // Add to available tags for future matching
            setAvailableTags(prev => [...prev, newTag]);
            newTagIds.push(newTag.id);
            addedTagNames.push(newTag.name);
          }
        }
      }

      // Add new tags to selected tags
      if (newTagIds.length > 0) {
        setSelectedTagIds(prev => [...prev, ...newTagIds]);
        toast.success(`Added AI suggested tags: ${addedTagNames.join(', ')}`);
      } else {
        toast.info('All suggested tags were already selected');
      }
    } catch (error) {
      console.error('Error handling AI suggested tags:', error);
      toast.error('Failed to add some AI suggested tags');
    }
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
      const aiModel = getAIModelFromQuestionSet();

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
        model: aiModel
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

      // Update tags if provided by AI
      if (data.suggested_tags && Array.isArray(data.suggested_tags)) {
        await handleAISuggestedTags(data.suggested_tags);
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit(handleSubmit)(e);
                }}
                className="flex flex-col h-full min-h-0"
              >
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  {/* AI Refinement Sidebar */}
                  <div className="w-80 flex-shrink-0 border-r bg-muted/30 flex flex-col">
                    <div className="p-4 border-b">
                      <h3 className="font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        AI Assistant
                      </h3>
                      {question?.set?.source_type === 'ai_generated' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Using {getAIModelFromQuestionSet()} from question set
                        </p>
                      )}
                      {(!question?.set || question?.set?.source_type !== 'ai_generated') && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Using {getAIModelFromQuestionSet()} (default)
                        </p>
                      )}
                    </div>
                    <div className="flex-1 p-4 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Request Changes</Label>
                        <Textarea
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Ask AI to modify specific parts of the question (e.g., 'Make the question more challenging', 'Add more clinical context', 'Improve the distractors')"
                          rows={4}
                          className="resize-none"
                        />
                      </div>
                      <Button
                        onClick={handleAIRefinement}
                        disabled={!chatMessage.trim() || isRefining}
                        className="w-full"
                        type="button"
                        size="sm"
                      >
                        {isRefining ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Refining...
                          </>
                        ) : (
                          <>
                            <Brain className="mr-2 h-3 w-3" />
                            Refine Question
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Main Content Area */}
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

                    {/* Edit Type Selection Section - for published questions */}
                    {question?.status === 'published' && (
                      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">Edit Type</h4>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                              Select the type of edit you're making to this published question.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Patch Edit Option */}
                          <div className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                            onClick={() => {
                              setIsPatchEdit(true);
                              form.setValue('updateType', 'patch');
                              handleUnsavedChanges();
                            }}>
                            <input
                              type="radio"
                              id="editType-patch"
                              name="editType"
                              checked={isPatchEdit}
                              onChange={() => {
                                setIsPatchEdit(true);
                                form.setValue('updateType', 'patch');
                                handleUnsavedChanges();
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <label htmlFor="editType-patch" className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer">
                                Patch Edit (No Review Needed)
                              </label>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                Typos, formatting, metadata only. Version: 1.0.x
                              </p>
                            </div>
                          </div>

                          {/* Minor Edit Option */}
                          <div className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                            onClick={() => {
                              setIsPatchEdit(false);
                              form.setValue('updateType', 'minor');
                              handleUnsavedChanges();
                            }}>
                            <input
                              type="radio"
                              id="editType-minor"
                              name="editType"
                              checked={!isPatchEdit && form.getValues('updateType') === 'minor'}
                              onChange={() => {
                                setIsPatchEdit(false);
                                form.setValue('updateType', 'minor');
                                handleUnsavedChanges();
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <label htmlFor="editType-minor" className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer">
                                Minor Edit (Requires Review)
                              </label>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                Content changes (stem, options, explanations, teaching point). Version: 1.x.0
                              </p>
                            </div>
                          </div>

                          {/* Major Edit Option */}
                          <div className="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                            onClick={() => {
                              setIsPatchEdit(false);
                              form.setValue('updateType', 'major');
                              handleUnsavedChanges();
                            }}>
                            <input
                              type="radio"
                              id="editType-major"
                              name="editType"
                              checked={!isPatchEdit && form.getValues('updateType') === 'major'}
                              onChange={() => {
                                setIsPatchEdit(false);
                                form.setValue('updateType', 'major');
                                handleUnsavedChanges();
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <label htmlFor="editType-major" className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer">
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
                            <label htmlFor="patchEditReason" className="text-xs font-medium text-blue-900 dark:text-blue-100">
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
