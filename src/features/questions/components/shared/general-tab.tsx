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
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { X } from 'lucide-react';
import { QuestionWithDetails } from '@/features/questions/types/questions';
import { useQuestionSets } from '@/features/questions/hooks/use-question-sets';
import { createClient } from '@/shared/services/client';
// Remove unused import

interface Tag {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface GeneralTabProps {
  form: UseFormReturn<any>;
  question?: QuestionWithDetails;
  selectedTagIds: string[];
  setSelectedTagIds: (tagIds: string[]) => void;
  onUnsavedChanges: () => void;
  mode?: 'create' | 'edit';
}

export function GeneralTab({ form, question, selectedTagIds, setSelectedTagIds, onUnsavedChanges, mode = 'edit' }: GeneralTabProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  
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

  // Initialize selected tags and category
  useEffect(() => {
    if (question && question.tags && question.tags.length > 0) {
      const tagIds = question.tags.map(tag => tag.id);
      setSelectedTagIds(tagIds);
    } else {
      setSelectedTagIds([]);
    }
  }, [question]);

  useEffect(() => {
    if (question) {
      const categoryId = question.categories?.[0]?.id || 'none';
      const formCategoryValue = categoryId === 'none' ? null : categoryId;
      form.setValue('category_id', formCategoryValue);
    }
  }, [question, form]);

  // Initialize selected tags from question data
  useEffect(() => {
    if (question && mode === 'edit') {
      const tagIds = question.tags?.map(tag => tag.id) || [];
      setSelectedTagIds(tagIds);
    }
  }, [question, mode, setSelectedTagIds]);

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const handleTagToggle = useCallback((tagId: string) => {
    const newIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id: string) => id !== tagId)
      : [...selectedTagIds, tagId];

    setSelectedTagIds(newIds);
    onUnsavedChanges();
  }, [selectedTagIds, setSelectedTagIds, onUnsavedChanges]);

  const handleCreateTag = useCallback(async (tagName: string) => {
    try {
      const supabase = createClient();
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert([{ name: tagName }])
        .select()
        .single();

      if (error) {
        console.error('Error creating tag:', error);
        return;
      }

      if (newTag) {
        // Add to available tags
        setAvailableTags(prev => [...prev, newTag]);

        // Select the new tag
        const newIds = [...selectedTagIds, newTag.id];
        setSelectedTagIds(newIds);
        onUnsavedChanges();

        // Clear search
        setTagSearch('');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  }, [selectedTagIds, setSelectedTagIds, onUnsavedChanges]);

  const selectedTags = availableTags.filter(tag => selectedTagIds.includes(tag.id));

  return (
    <div className="space-y-6">
      {/* Title */}
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Enter question title" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Question Stem */}
      <FormField
        control={form.control}
        name="stem"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Question</FormLabel>
            <FormControl>
              <Textarea 
                {...field} 
                placeholder="Enter the question text"
                className="min-h-[120px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-3 gap-4">
        {/* Difficulty */}
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

        {/* Category */}
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                value={field.value || 'none'}
                onValueChange={(value) => {
                  const categoryValue = value === 'none' ? null : value;
                  field.onChange(categoryValue);
                  onUnsavedChanges();
                }}
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
      </div>

      {/* Tags Section */}
      <div>
        <FormLabel>Tags</FormLabel>
        
        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedTags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
              >
                {tag.name}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-primary/20"
                  onClick={() => handleTagToggle(tag.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Tag Search */}
        <div className="space-y-2">
          <Input
            placeholder="Search tags or press Enter to create new..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagSearch.trim()) {
                e.preventDefault();
                const existingTag = availableTags.find(tag =>
                  tag.name.toLowerCase() === tagSearch.trim().toLowerCase()
                );
                if (existingTag) {
                  handleTagToggle(existingTag.id);
                  setTagSearch('');
                } else {
                  handleCreateTag(tagSearch.trim());
                }
              }
            }}
          />
          
          {/* Available Tags */}
          <div className="max-h-32 overflow-y-auto border rounded-md p-2">
            {filteredTags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {filteredTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <Button
                      key={tag.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleTagToggle(tag.id)}
                    >
                      {tag.name}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {tagSearch.trim() ? (
                  <>No tags found. Press Enter to create "{tagSearch.trim()}"</>
                ) : (
                  'No tags available'
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
