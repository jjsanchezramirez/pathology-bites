// src/components/questions/edit-question-dialog.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
// Removed AlertDialog imports - using regular Dialog for consistency
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";

import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Loader2, Plus, X, ChevronDown } from 'lucide-react';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { QuestionWithDetails } from '@/features/questions/types/questions';
import { useQuestionSets } from '@/features/questions/hooks/use-question-sets';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { useUserRole } from '@/shared/hooks/use-user-role';
import { CompactAnswerOptions } from './compact-answer-options';
import { ImageAttachment } from './image-attachment';
import { SimpleTagsSelector } from './simple-tags-selector';
import { CategoriesDropdown } from './categories-dropdown';
import { AnswerOptionFormData, QuestionImageFormData, UpdateType } from '@/features/questions/types/questions';

// Note: Helper functions removed - now using comprehensive versioning API

// Type definitions for tags and categories
interface Tag {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}







const editQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'under_review', 'approved_with_edits', 'rejected', 'published', 'flagged', 'archived']),
  question_set_id: z.string(),
});

type EditQuestionFormData = z.infer<typeof editQuestionSchema>;

// MediaSection component for handling images in specific sections
interface MediaSectionProps {
  images: QuestionImageFormData[];
  section: 'stem' | 'explanation';
  maxImages: number;
  onImagesChange: (images: QuestionImageFormData[]) => void;
}

function MediaSection({ images, section, maxImages, onImagesChange }: MediaSectionProps) {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [availableImages, setAvailableImages] = useState<any[]>([]);
  const [currentImages, setCurrentImages] = useState<any[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const { fetchImages } = await import('@/features/images/services/images');
      const result = await fetchImages({
        page: 0,
        pageSize: 10, // Load exactly 10 images (2 rows of 5)
        searchTerm: searchTerm || undefined,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAvailableImages(result.data);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  // Load current images data when images prop changes
  const loadCurrentImages = useCallback(async () => {
    if (images.length === 0) {
      setCurrentImages([]);
      return;
    }

    try {
      const { fetchImages } = await import('@/features/images/services/images');
      const result = await fetchImages({
        page: 0,
        pageSize: 100, // Get enough to cover all possible images
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Map the current images to their full data
      const imageData = images.map(img => {
        const fullImageData = result.data.find(availImg => availImg.id === img.image_id);
        return {
          ...img,
          imageData: fullImageData
        };
      });

      setCurrentImages(imageData);
    } catch (error) {
      console.error('Failed to load current images:', error);
      setCurrentImages([]);
    }
  }, [images]);

  useEffect(() => {
    if (showImagePicker) {
      loadImages();
      setSelectedImageIds([]); // Reset selection when opening
    }
  }, [loadImages, showImagePicker]);

  useEffect(() => {
    loadCurrentImages();
  }, [loadCurrentImages]);

  const handleImageToggle = (imageId: string) => {
    // Check if image is already added to this section
    const imageAlreadyExists = images.some(img => img.image_id === imageId);
    if (imageAlreadyExists) {
      return; // Don't allow selecting already added images
    }

    setSelectedImageIds(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId);
      } else {
        // Check if we would exceed the limit
        const remainingSlots = maxImages - images.length;
        if (prev.length >= remainingSlots) {
          return prev; // Don't add more if it would exceed limit
        }
        return [...prev, imageId];
      }
    });
  };

  const handleSelectImages = () => {
    const newImages: QuestionImageFormData[] = selectedImageIds.map((imageId, index) => ({
      image_id: imageId,
      question_section: section,
      order_index: images.length + index
    }));

    onImagesChange([...images, ...newImages]);
    setSelectedImageIds([]);
    setShowImagePicker(false);
  };

  const handleCancelSelection = () => {
    setSelectedImageIds([]);
    setShowImagePicker(false);
  };

  const handleRemoveImage = (imageId: string, indexToRemove?: number) => {
    let updatedImages;

    if (indexToRemove !== undefined) {
      // Remove specific instance by index
      updatedImages = images.filter((img, index) => index !== indexToRemove);
    } else {
      // Remove first occurrence of the image (fallback)
      const imageIndex = images.findIndex(img => img.image_id === imageId);
      if (imageIndex !== -1) {
        updatedImages = images.filter((img, index) => index !== imageIndex);
      } else {
        return; // Image not found
      }
    }

    // Reorder remaining images
    const reorderedImages = updatedImages.map((img, index) => ({
      ...img,
      order_index: index
    }));
    onImagesChange(reorderedImages);
  };

  return (
    <div>
      {/* Current Images Grid */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {currentImages.map((imageItem, index) => {
          const imageInfo = imageItem.imageData;
          // Create unique key combining section, image_id, and index to handle duplicate images
          const uniqueKey = `${section}-${imageItem.image_id}-${index}`;

          return (
            <div key={uniqueKey} className="relative group aspect-square">
              <div className="w-full h-full bg-muted rounded border flex items-center justify-center">
                {imageInfo ? (
                  <img
                    src={imageInfo.url}
                    alt={imageInfo.alt_text || ''}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground text-center p-1">
                    Loading...
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveImage(imageItem.image_id, index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}

        {/* Add Image Button */}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => setShowImagePicker(true)}
            className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center hover:border-muted-foreground/50 transition-colors"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Image Picker Dialog */}
      <Dialog open={showImagePicker} onOpenChange={handleCancelSelection} modal={false}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="!max-w-[1090px] !w-[1090px] max-h-[85vh] overflow-hidden border-0">
            <DialogHeader>
              <DialogTitle>Select Images for {section === 'stem' ? 'Question Body' : 'Explanation'}</DialogTitle>
              <DialogDescription>
                Choose up to {maxImages - images.length} more image{maxImages - images.length !== 1 ? 's' : ''} for this section.
                {selectedImageIds.length > 0 && ` ${selectedImageIds.length} image${selectedImageIds.length !== 1 ? 's' : ''} selected.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 flex-1 overflow-hidden">
              <Input
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <div className="border rounded-lg p-4">
                {loading ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="text-sm text-muted-foreground">Loading images...</div>
                  </div>
                ) : availableImages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12">
                    <p>No images found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-3">
                    {availableImages.map((image) => {
                      const isSelected = selectedImageIds.includes(image.id);
                      const isAlreadyAdded = images.some(img => img.image_id === image.id);
                      const canSelect = !isAlreadyAdded && (isSelected || selectedImageIds.length < (maxImages - images.length));

                      return (
                        <div
                          key={image.id}
                          className={`relative cursor-pointer rounded border-2 transition-all w-48 h-48 ${
                            isAlreadyAdded
                              ? 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'border-primary bg-primary/10'
                                : canSelect
                                  ? 'border-border hover:border-primary/50'
                                  : 'border-muted opacity-50 cursor-not-allowed'
                          }`}
                          onClick={() => canSelect && handleImageToggle(image.id)}
                          title={isAlreadyAdded ? 'Already added to this section' : image.alt_text || ''}
                        >
                          <img
                            src={image.url}
                            alt={image.alt_text || ''}
                            className="w-48 h-48 object-cover rounded"
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                              ✓
                            </div>
                          )}
                          {isAlreadyAdded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                              <span className="text-white text-xs font-medium">Added</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCancelSelection}>
                Cancel
              </Button>
              <Button
                onClick={handleSelectImages}
                disabled={selectedImageIds.length === 0}
              >
                Select {selectedImageIds.length > 0 ? `${selectedImageIds.length} ` : ''}Image{selectedImageIds.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [dataLoadingProgress, setDataLoadingProgress] = useState({
    question: false,
    options: false,
    images: false,
    tags: false,
    categories: false
  });

  // Enhanced form state - Default to 5 answer options
  const [answerOptions, setAnswerOptions] = useState<AnswerOptionFormData[]>([
    { text: '', is_correct: true, explanation: '', order_index: 0 },
    { text: '', is_correct: false, explanation: '', order_index: 1 },
    { text: '', is_correct: false, explanation: '', order_index: 2 },
    { text: '', is_correct: false, explanation: '', order_index: 3 },
    { text: '', is_correct: false, explanation: '', order_index: 4 }
  ]);
  const [questionImages, setQuestionImages] = useState<QuestionImageFormData[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [updateType, setUpdateType] = useState<UpdateType>('minor');
  const [changeSummary, setChangeSummary] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [answerOptionErrors, setAnswerOptionErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { updateQuestion } = useQuestions();
  const { questionSets } = useQuestionSets();
  const { user } = useAuthStatus();
  const { isAdmin } = useUserRole();

  // Filter tags based on search
  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const form = useForm<EditQuestionFormData>({
    resolver: zodResolver(editQuestionSchema),
    defaultValues: {
      title: '',
      stem: '',
      difficulty: 'medium',
      teaching_point: '',
      question_references: '',
      status: 'draft',
      question_set_id: 'none',
    },
  });

  // Track form changes (but ignore during initialization)
  useEffect(() => {
    const subscription = form.watch((_, { type }) => {
      console.log('🔍 Form watch triggered:', { type, isInitializing, hasUnsavedChanges });
      if (type === 'change' && !isInitializing) {
        console.log('✅ Setting hasUnsavedChanges to true');
        setHasUnsavedChanges(true);
      } else {
        console.log('❌ Ignoring change:', { type, isInitializing });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, isInitializing, hasUnsavedChanges]);

  // Remove this useEffect - it's causing false positives
  // The form watch should be sufficient for detecting changes

  // Fetch complete question data when dialog opens
  const [fullQuestionData, setFullQuestionData] = useState<QuestionWithDetails | null>(null);

  const fetchCompleteQuestionData = useCallback(async (questionId: string) => {
    try {
      setIsLoadingData(true);
      setIsLoadingImages(true);
      setDataLoadingProgress({
        question: false,
        options: false,
        images: false,
        tags: false,
        categories: false
      });

      const { createClient } = await import('@/shared/services/client');
      const supabase = createClient();

      console.log('🔄 Starting to fetch question data for:', questionId);
      const startTime = Date.now();

      // Run all queries in parallel for better performance
      const [
        questionResult,
        optionsResult,
        imagesResult,
        tagsResult,
        categoriesResult,
        allTagsResult,
        allCategoriesResult
      ] = await Promise.all([
        // Basic question data with creator and editor names
        supabase
          .from('questions')
          .select(`
            *,
            created_by_name:users!questions_created_by_fkey(first_name, last_name),
            current_editor_name:users!questions_current_editor_id_fkey(first_name, last_name)
          `)
          .eq('id', questionId)
          .single(),

        // Question options
        supabase
          .from('question_options')
          .select('*')
          .eq('question_id', questionId)
          .order('order_index'),

        // Question images with image data
        supabase
          .from('question_images')
          .select(`
            *,
            image:images(*)
          `)
          .eq('question_id', questionId)
          .order('order_index'),

        // Tags
        supabase
          .from('question_tags')
          .select(`
            tag:tags(*)
          `)
          .eq('question_id', questionId),

        // Categories (keeping for backward compatibility)
        supabase
          .from('question_categories')
          .select(`
            category:categories(*)
          `)
          .eq('question_id', questionId),

        // All available tags
        supabase
          .from('tags')
          .select('*')
          .order('name'),

        // All available categories
        supabase
          .from('categories')
          .select('*')
          .order('name')
      ]);

      const fetchTime = Date.now() - startTime;
      console.log(`⚡ Fetched all question data in ${fetchTime}ms`);

      // Check for errors and validate data
      if (questionResult.error) {
        console.error('Error fetching question data:', questionResult.error);
        return;
      }

      const { data: questionData } = questionResult;
      const { data: questionOptions } = optionsResult;
      const { data: questionImages } = imagesResult;
      const { data: questionTags } = tagsResult;
      const { data: questionCategories } = categoriesResult;
      const { data: allTags } = allTagsResult;
      const { data: allCategories } = allCategoriesResult;

      // Update loading progress
      setDataLoadingProgress({
        question: !!questionData,
        options: questionOptions !== null,
        images: questionImages !== null,
        tags: questionTags !== null,
        categories: questionCategories !== null
      });

      console.log('📊 Data loading progress:', {
        question: !!questionData,
        options: questionOptions?.length || 0,
        images: questionImages?.length || 0,
        tags: questionTags?.length || 0,
        categories: questionCategories?.length || 0
      });

      console.log('Raw questionTags data:', questionTags);
      console.log('Tags error:', tagsResult.error);

      // Process creator and editor names
      const createdByName = questionData.created_by_name
        ? `${questionData.created_by_name.first_name} ${questionData.created_by_name.last_name}`
        : null;
      const currentEditorName = questionData.current_editor_name
        ? `${questionData.current_editor_name.first_name} ${questionData.current_editor_name.last_name}`
        : null;

      // Process tags - extract the actual tag data from the nested structure
      const processedTags = questionTags?.map(item => item.tag).filter(tag => tag !== null) || [];
      console.log('Processed tags:', processedTags);

      // Combine all data
      const completeData = {
        ...questionData,
        created_by_name: createdByName,
        current_editor_name: currentEditorName,
        question_options: questionOptions || [],
        question_images: questionImages || [],
        tags: processedTags,
        categories: questionCategories || []
      };

      const totalTime = Date.now() - startTime;
      console.log(`✅ Complete question data loaded in ${totalTime}ms:`, completeData);

      // Validate that all essential data is present
      const isDataComplete = !!(
        questionData &&
        questionOptions !== null &&
        questionImages !== null &&
        questionTags !== null
      );

      console.log('🔍 Data completeness check:', {
        hasQuestion: !!questionData,
        hasOptions: questionOptions !== null,
        hasImages: questionImages !== null,
        hasTags: questionTags !== null,
        isComplete: isDataComplete
      });

      if (isDataComplete) {
        setFullQuestionData(completeData);

        // Set available tags and categories for the form
        if (allTags) {
          setAvailableTags(allTags);
        }
        if (allCategories) {
          setAvailableCategories(allCategories);
        }

        // Add smooth transition delay for better UX
        setTimeout(() => {
          setIsLoadingImages(false);
        }, 200);
      } else {
        console.warn('⚠️ Incomplete data detected, keeping loading state');
      }
    } catch (error) {
      console.error('❌ Error fetching complete question data:', error);
    } finally {
      // Only end main loading if data is complete
      setTimeout(() => {
        setIsLoadingData(false);
      }, 150);
    }
  }, []);

  // Fetch complete data when question changes and dialog opens
  useEffect(() => {
    if (question && open) {
      console.log('🚀 useEffect triggered - fetching question data for:', question.id);
      setIsLoadingData(true);
      fetchCompleteQuestionData(question.id);
    }
  }, [question, open, fetchCompleteQuestionData]);

  // Initialize form when complete question data is loaded
  useEffect(() => {
    if (fullQuestionData && open) {
      console.log('🚀 Starting form initialization');
      setIsInitializing(true);
      form.reset({
        title: fullQuestionData.title || '',
        stem: fullQuestionData.stem || '',
        difficulty: fullQuestionData.difficulty as 'easy' | 'medium' | 'hard',
        teaching_point: fullQuestionData.teaching_point || '',
        question_references: fullQuestionData.question_references || '',
        status: fullQuestionData.status as 'draft' | 'published' | 'archived',
        question_set_id: fullQuestionData.question_set_id || 'none',
      });

      // Load existing question options (check both new and legacy field names)
      const existingOptions = fullQuestionData.question_options || fullQuestionData.answer_options;
      if (existingOptions && existingOptions.length > 0) {
        const sortedOptions = [...existingOptions].sort((a, b) => a.order_index - b.order_index);
        setAnswerOptions(sortedOptions.map(option => ({
          text: option.text,
          is_correct: option.is_correct,
          explanation: option.explanation || '',
          order_index: option.order_index
        })));
      } else {
        // Default empty options if none exist
        setAnswerOptions([
          { text: '', is_correct: true, explanation: '', order_index: 0 },
          { text: '', is_correct: false, explanation: '', order_index: 1 },
          { text: '', is_correct: false, explanation: '', order_index: 2 },
          { text: '', is_correct: false, explanation: '', order_index: 3 },
          { text: '', is_correct: false, explanation: '', order_index: 4 }
        ]);
      }

      // Load existing images
      if (fullQuestionData.question_images && fullQuestionData.question_images.length > 0) {
        setQuestionImages(fullQuestionData.question_images.map(qi => ({
          image_id: qi.image?.id || '',
          question_section: (qi.question_section === 'explanation' ? 'explanation' : 'stem') as 'stem' | 'explanation',
          order_index: qi.order_index || 0
        })));
      } else {
        setQuestionImages([]);
      }

      // Load existing tags
      if (fullQuestionData.tags && fullQuestionData.tags.length > 0) {
        setSelectedTagIds(fullQuestionData.tags.map(tag => tag.id));
      } else {
        setSelectedTagIds([]);
      }

      // Load existing categories
      if (fullQuestionData.categories && fullQuestionData.categories.length > 0) {
        setSelectedCategoryId(fullQuestionData.categories[0].id);
      } else {
        setSelectedCategoryId('');
      }

      setHasUnsavedChanges(false);
      console.log('📝 Form data populated, setting hasUnsavedChanges to false');

      // Use setTimeout to ensure all form updates are complete before allowing change detection
      setTimeout(() => {
        console.log('✅ Form initialization complete, enabling change detection');
        console.log('📊 Current state:', { hasUnsavedChanges, answerOptionsCount: answerOptions.length, selectedTagsCount: selectedTagIds.length });
        setIsInitializing(false);
      }, 100);
    }
  }, [fullQuestionData, open, form]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setHasAttemptedSubmit(false);
      setHasUnsavedChanges(false);
      setIsInitializing(false);
      setIsDropdownOpen(false); // Close dropdown when dialog closes
    }
  }, [open]);

  // Validation function for answer options
  const validateAnswerOptions = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    console.log('🔍 Validating answer options:', answerOptions);

    if (answerOptions.length < 2) {
      errors.options = 'At least 2 answer options are required';
      console.log('❌ Not enough options:', answerOptions.length);
      return errors;
    }

    const correctAnswers = answerOptions.filter(opt => opt.is_correct);
    console.log('✅ Correct answers found:', correctAnswers.length);
    if (correctAnswers.length !== 1) {
      errors.options = 'Exactly one correct answer must be selected';
      console.log('❌ Wrong number of correct answers:', correctAnswers.length);
    }

    answerOptions.forEach((option, index) => {
      console.log(`🔍 Checking option ${index}:`, { text: option.text, is_correct: option.is_correct, explanation: option.explanation });
      if (!option.text.trim()) {
        errors[`option_${index}_text`] = 'Option text is required';
        console.log(`❌ Option ${index} missing text`);
      }
      if (!option.is_correct && !option.explanation?.trim()) {
        errors[`option_${index}_explanation`] = 'Explanation is required for incorrect answers';
        console.log(`❌ Option ${index} missing explanation`);
      }
    });

    console.log('🔍 Validation errors:', JSON.stringify(errors, null, 2));
    return errors;
  };

  const handleUpdateWithType = async (selectedUpdateType: UpdateType) => {
    if (!question) return;

    // Get current form data
    const data = form.getValues();

    setHasAttemptedSubmit(true);

    if (!user) {
      toast.error('You must be logged in to update questions');
      return;
    }

    // Check admin permissions for published questions
    if (question.status === 'published' && !isAdmin) {
      toast.error('Only admins can edit published questions');
      return;
    }

    // Validate answer options
    const optionErrors = validateAnswerOptions();
    if (Object.keys(optionErrors).length > 0) {
      toast.error('Please fix the answer options errors');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update the question
      const updateData = {
        ...data,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
      };

      console.log('Updating question with data:', updateData);
      console.log('Answer options being sent:', JSON.stringify(answerOptions, null, 2));

      // Use the new versioning-aware update function
      await updateQuestion(question.id, updateData, {
        updateType: question.status === 'published' ? selectedUpdateType : undefined,
        changeSummary: question.status === 'published' ? changeSummary : undefined,
        answerOptions,
        questionImages,
        tagIds: selectedTagIds,
        categoryId: selectedCategoryId || undefined,
      });

      toast.success('Question updated successfully');

      // Reset form state
      setHasUnsavedChanges(false);
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update question:', error);

      // Provide specific error message for version conflicts
      let errorMessage = 'Failed to update question';
      if (error instanceof Error) {
        if (error.message.includes('question_versions_question_id_version_number_key')) {
          errorMessage = 'Question update conflict detected. Please try again in a moment.';
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: EditQuestionFormData) => {
    if (!question) return;

    setHasAttemptedSubmit(true);

    if (!user) {
      toast.error('You must be logged in to update questions');
      return;
    }

    // Check admin permissions for published questions
    if (question.status === 'published' && !isAdmin) {
      toast.error('Only admins can edit published questions');
      return;
    }

    // Validate answer options
    const optionErrors = validateAnswerOptions();
    if (Object.keys(optionErrors).length > 0) {
      toast.error('Please fix the answer options errors');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update the question
      const updateData = {
        ...data,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
      };

      console.log('Updating question with data:', updateData);
      console.log('Answer options being sent:', JSON.stringify(answerOptions, null, 2));

      // Use the new versioning-aware update function
      await updateQuestion(question.id, updateData, {
        updateType: question.status === 'published' ? updateType : undefined,
        changeSummary: question.status === 'published' ? changeSummary : undefined,
        answerOptions,
        questionImages,
        tagIds: selectedTagIds,
        categoryId: selectedCategoryId || undefined,
      });

      toast.success('Question updated successfully');

      // Reset form state
      setHasUnsavedChanges(false);
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update question:', error);

      // Provide specific error message for version conflicts
      let errorMessage = 'Failed to update question';
      if (error instanceof Error) {
        if (error.message.includes('question_versions_question_id_version_number_key')) {
          errorMessage = 'Question update conflict detected. Please try again in a moment.';
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormState = () => {
    setHasAttemptedSubmit(false);
    setHasUnsavedChanges(false);
    setIsInitializing(false);
    setIsDropdownOpen(false);
    setIsLoadingData(false);
    setIsLoadingImages(false);
    setDataLoadingProgress({
      question: false,
      options: false,
      images: false,
      tags: false,
      categories: false
    });
    setFullQuestionData(null);
    setTagSearch('');
    form.reset();
    setAnswerOptions([
      { text: '', is_correct: true, explanation: '', order_index: 0 },
      { text: '', is_correct: false, explanation: '', order_index: 1 },
      { text: '', is_correct: false, explanation: '', order_index: 2 },
      { text: '', is_correct: false, explanation: '', order_index: 3 },
      { text: '', is_correct: false, explanation: '', order_index: 4 }
    ]);
    setQuestionImages([]);
    setSelectedTagIds([]);
    setSelectedCategoryId('');
  };

  const handleOpenChange = (open: boolean) => {
    console.log('🚪 handleOpenChange called:', { open, hasUnsavedChanges, isSubmitting });
    if (!isSubmitting) {
      if (!open && hasUnsavedChanges) {
        console.log('⚠️ Showing confirmation dialog - unsaved changes detected');
        // Show confirmation dialog if there are unsaved changes
        setShowConfirmDialog(true);
        return; // Don't close the main dialog yet
      } else {
        console.log('✅ Closing dialog without confirmation');
        if (!open) {
          resetFormState();
        }
        onOpenChange(open);
      }
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    resetFormState();
    // Use setTimeout to ensure the confirmation dialog closes first
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };



  if (!question) return null;

  return (
    <div>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full max-w-[min(85vw,1200px)] sm:max-w-[min(85vw,1200px)] h-[75vh] border-0 flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update the question details. You can modify answer options, images, tags, and categories.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">

              {/* Loading Skeleton */}
              {isLoadingData ? (
                <div className="flex flex-col h-full space-y-4 p-4">
                  {/* Tabs skeleton */}
                  <div className="grid w-full grid-cols-4 gap-2">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-10 w-full"
                      />
                    ))}
                  </div>

                  {/* Form fields skeleton */}
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-12" />
                      <div className="flex gap-2">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton
                            key={i}
                            className="h-8 w-16"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom buttons skeleton */}
                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-10 w-20" />
                      <Skeleton className="h-10 w-32" />
                    </div>
                  </div>
                </div>
              ) : (
                <div>


                  <Tabs defaultValue="general" className="flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="general">General</TabsTrigger>
                      <TabsTrigger value="options">Options</TabsTrigger>
                      <TabsTrigger value="references">References</TabsTrigger>
                      <TabsTrigger value="media">Media</TabsTrigger>
                    </TabsList>

                    {/* Tab 1: General */}
                    <TabsContent value="general" className="space-y-4 flex-1">
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title</FormLabel>
                              <FormControl>
                                <Input placeholder="Question title" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="stem"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Question Stem</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Enter the question text..."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="review">Under Review</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="difficulty"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Difficulty</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select difficulty" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="easy">Easy</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Category Selection */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Category</label>
                            <Select
                              onValueChange={(value) => {
                                setSelectedCategoryId(value);
                                setHasUnsavedChanges(true);
                              }}
                              value={selectedCategoryId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCategories.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Tags Section with Search */}
                        <div className="space-y-2">
                          <FormLabel>Tags</FormLabel>
                          <Input
                            placeholder="Search tags..."
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            className="mb-2"
                          />
                          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {filteredTags.map((tag) => (
                              <Button
                                key={tag.id}
                                type="button"
                                variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setSelectedTagIds(prev =>
                                    prev.includes(tag.id)
                                      ? prev.filter(id => id !== tag.id)
                                      : [...prev, tag.id]
                                  );
                                  setHasUnsavedChanges(true);
                                }}
                              >
                                {tag.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Tab 2: Answer Options */}
                    <TabsContent value="options" className="space-y-4 flex-1">
                      <CompactAnswerOptions
                        options={answerOptions}
                        onChange={(newOptions) => {
                          setAnswerOptions(newOptions);
                          setHasUnsavedChanges(true);
                        }}
                        errors={hasAttemptedSubmit ? answerOptionErrors : undefined}
                      />
                    </TabsContent>

                    {/* Tab 3: References & Teaching Point */}
                    <TabsContent value="references" className="space-y-4 flex-1">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="teaching_point"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Teaching Point</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Key learning point or takeaway from this question..."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="question_references"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>References</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Add references, citations, or sources..."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>

                    {/* Tab 4: Media */}
                    <TabsContent value="media" className="space-y-6 h-full">
                      {isLoadingImages ? (
                        <div className="space-y-6">
                          {/* Question Body Images Skeleton */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Skeleton className="h-5 w-40" />
                              <Skeleton className="h-4 w-8" />
                            </div>
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
                              <div className="grid grid-cols-5 gap-4">
                                {[...Array(3)].map((_, i) => (
                                  <div key={i} className="aspect-square">
                                    <Skeleton className="w-full h-full rounded-lg" />
                                  </div>
                                ))}
                                {/* Add image placeholders */}
                                {[...Array(2)].map((_, i) => (
                                  <div key={`add-${i}`} className="aspect-square">
                                    <Skeleton className="w-full h-full rounded-lg opacity-50" />
                                  </div>
                                ))}
                              </div>
                              <div className="mt-4 text-center">
                                <Skeleton className="h-4 w-48 mx-auto" />
                              </div>
                            </div>
                          </div>

                          {/* Explanation Images Skeleton */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Skeleton className="h-5 w-36" />
                              <Skeleton className="h-4 w-8" />
                            </div>
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
                              <div className="grid grid-cols-5 gap-4">
                                <div className="aspect-square">
                                  <Skeleton className="w-full h-full rounded-lg" />
                                </div>
                                {/* Add image placeholders */}
                                {[...Array(4)].map((_, i) => (
                                  <div key={`add-exp-${i}`} className="aspect-square">
                                    <Skeleton className="w-full h-full rounded-lg opacity-50" />
                                  </div>
                                ))}
                              </div>
                              <div className="mt-4 text-center">
                                <Skeleton className="h-4 w-48 mx-auto" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Question Body Images */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium">Question Body Images</h4>
                              <span className="text-xs text-muted-foreground">
                                {questionImages.filter(img => img.question_section === 'stem').length}/3
                              </span>
                            </div>
                            <MediaSection
                              images={questionImages.filter(img => img.question_section === 'stem')}
                              section="stem"
                              maxImages={3}
                              onImagesChange={(newImages) => {
                                const explanationImages = questionImages.filter(img => img.question_section === 'explanation');
                                setQuestionImages([...newImages, ...explanationImages]);
                              }}
                            />
                          </div>

                          {/* Explanation Images */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium">Explanation Images</h4>
                              <span className="text-xs text-muted-foreground">
                                {questionImages.filter(img => img.question_section === 'explanation').length}/1
                              </span>
                            </div>
                            <MediaSection
                              images={questionImages.filter(img => img.question_section === 'explanation')}
                              section="explanation"
                              maxImages={1}
                              onImagesChange={(newImages) => {
                                const stemImages = questionImages.filter(img => img.question_section === 'stem');
                                setQuestionImages([...stemImages, ...newImages]);
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              <div className="flex justify-between items-center gap-3 pt-6 flex-shrink-0 border-t bg-background">
                {/* Metadata */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {question.created_by_name && <span>Created by {question.created_by_name} on {new Date(question.created_at).toLocaleDateString()}</span>}
                  <span>Last updated on {new Date(question.updated_at).toLocaleDateString()}</span>
                  {question.version_string && <span>v{question.version_string}</span>}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>

                  {question?.status === 'published' && isAdmin ? (
                    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" disabled={isSubmitting || !hasUnsavedChanges}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              {hasUnsavedChanges ? 'Update Question' : 'No Changes'}
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuItem
                          onClick={() => {
                            setIsDropdownOpen(false);
                            handleUpdateWithType('patch');
                          }}
                          disabled={isSubmitting}
                          className="hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">Patch Update</span>
                            <span className="text-xs text-muted-foreground">
                              v{question.version_major || 1}.{question.version_minor || 0}.{(question.version_patch || 0) + 1}
                            </span>
                            <span className="text-xs text-muted-foreground">Typos, formatting, references</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setIsDropdownOpen(false);
                            handleUpdateWithType('minor');
                          }}
                          disabled={isSubmitting}
                          className="hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">Minor Update</span>
                            <span className="text-xs text-muted-foreground">
                              v{question.version_major || 1}.{(question.version_minor || 0) + 1}.0
                            </span>
                            <span className="text-xs text-muted-foreground">Content changes, options, explanations</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setIsDropdownOpen(false);
                            handleUpdateWithType('major');
                          }}
                          disabled={isSubmitting}
                          className="hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">Major Update</span>
                            <span className="text-xs text-muted-foreground">
                              v{(question.version_major || 1) + 1}.0.0
                            </span>
                            <span className="text-xs text-muted-foreground">Complete rewrite or restructure</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button type="submit" disabled={isSubmitting || !hasUnsavedChanges}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          {hasUnsavedChanges ? 'Update Question' : 'No Changes'}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </DialogPortal>
    </Dialog>

    {/* Confirmation Dialog for Unsaved Changes */}
    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to close without saving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmClose}
            >
              Close Without Saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
    </div>
  );
}
