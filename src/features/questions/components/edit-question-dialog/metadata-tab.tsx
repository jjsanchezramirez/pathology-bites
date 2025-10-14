'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { X, Brain, Loader2 } from 'lucide-react';
import { QuestionWithDetails } from '@/features/questions/types/questions';
import { useQuestionSets } from '@/features/questions/hooks/use-question-sets';
import { createClient } from '@/shared/services/client';
import { EditQuestionFormData } from '@/features/questions/hooks/use-edit-question-form';
import { toast } from 'sonner';

interface Tag {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface MetadataTabProps {
  form: UseFormReturn<EditQuestionFormData>;
  question: QuestionWithDetails;
  onUnsavedChanges: () => void;
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function MetadataTab({
  form,
  question,
  onUnsavedChanges,
  selectedTagIds,
  onTagsChange
}: MetadataTabProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  
  const { questionSets } = useQuestionSets();

  // Load initial tags and categories
  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();

        const [tagsResult, categoriesResult] = await Promise.all([
          // Get 50 most recently created tags
          supabase.from('tags').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('categories').select('*').order('name')
        ]);

        if (tagsResult.data) {
          setAvailableTags(tagsResult.data);
        }
        if (categoriesResult.data) setAvailableCategories(categoriesResult.data);
      } catch (error) {
        console.error('Error loading tags/categories:', error);
      }
    };

    loadData();
  }, []);

  // Merge question tags with available tags when question changes
  useEffect(() => {
    if (question?.tags && question.tags.length > 0) {
      setAvailableTags(prevTags => {
        const existingTags = question.tags || [];
        const allTags = [...prevTags];

        // Add any question tags that aren't in the available tags
        existingTags.forEach(existingTag => {
          if (!allTags.find(tag => tag.id === existingTag.id)) {
            allTags.push(existingTag);
          }
        });

        return allTags;
      });
    }
  }, [question?.tags]);

  // Handle AI metadata suggestion
  const handleAIMetadataSuggestion = async () => {
    const currentFormData = form.getValues();
    
    if (!currentFormData.title || !currentFormData.stem) {
      toast.error('Please fill in the title and question stem first');
      return;
    }

    setIsGeneratingMetadata(true);
    try {
      const response = await fetch('/api/admin/ai-generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'metadata_suggestion',
          question: {
            title: currentFormData.title,
            stem: currentFormData.stem,
            teaching_point: currentFormData.teaching_point
          },
          availableCategories: availableCategories.map(c => ({ id: c.id, name: c.name })),
          availableQuestionSets: questionSets.map(qs => ({ id: qs.id, name: qs.name })),
          availableTags: availableTags.map(t => ({ id: t.id, name: t.name })),
          model: 'Llama-3.3-8B-Instruct'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate metadata suggestions');
      }

      const data = await response.json();
      
      // Apply suggestions
      if (data.difficulty) {
        form.setValue('difficulty', data.difficulty);
      }
      if (data.category_id) {
        form.setValue('category_id', data.category_id);
      }
      if (data.question_set_id) {
        form.setValue('question_set_id', data.question_set_id);
      }
      if (data.suggested_tags && Array.isArray(data.suggested_tags)) {
        onTagsChange(data.suggested_tags);
      }

      onUnsavedChanges();
      toast.success('AI metadata suggestions applied!');
    } catch (error) {
      console.error('AI metadata suggestion error:', error);
      toast.error('Failed to generate metadata suggestions');
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  const handleAddTag = (tagId: string) => {
    if (!selectedTagIds.includes(tagId)) {
      onTagsChange([...selectedTagIds, tagId]);
      onUnsavedChanges();
    }
    setTagSearch('');
  };

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
    onUnsavedChanges();
  };

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
    !selectedTagIds.includes(tag.id)
  );

  const selectedTags = availableTags.filter(tag => selectedTagIds.includes(tag.id));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Question Metadata</h2>
        <p className="text-muted-foreground">
          Categorize and organize your question with appropriate metadata.
        </p>
      </div>

      {/* AI Metadata Suggestion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Metadata Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Let AI analyze your question content and suggest appropriate category, question set, difficulty, and tags.
            </p>
            <Button
              onClick={handleAIMetadataSuggestion}
              disabled={isGeneratingMetadata}
              variant="outline"
            >
              {isGeneratingMetadata ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Suggest Metadata
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Difficulty */}
      <FormField
        control={form.control}
        name="difficulty"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Difficulty</FormLabel>
            <Select 
              onValueChange={(value) => {
                field.onChange(value);
                onUnsavedChanges();
              }} 
              defaultValue={field.value}
            >
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

      {/* Category */}
      <FormField
        control={form.control}
        name="category_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <Select 
              onValueChange={(value) => {
                field.onChange(value === 'none' ? null : value);
                onUnsavedChanges();
              }} 
              defaultValue={field.value || 'none'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">No Category</SelectItem>
                {availableCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Question Set */}
      <FormField
        control={form.control}
        name="question_set_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Question Set</FormLabel>
            <Select 
              onValueChange={(value) => {
                field.onChange(value);
                onUnsavedChanges();
              }} 
              defaultValue={field.value}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select question set" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">No Set</SelectItem>
                {questionSets.map((set) => (
                  <SelectItem key={set.id} value={set.id}>
                    {set.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Tags */}
      <div className="space-y-3">
        <Label>Tags</Label>
        
        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
                {tag.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => handleRemoveTag(tag.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Tag Search */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search tags..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md text-sm"
          />
          
          {tagSearch && filteredTags.length > 0 && (
            <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
              {filteredTags.slice(0, 10).map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleAddTag(tag.id)}
                  className="block w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
