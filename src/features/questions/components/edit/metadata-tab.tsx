"use client";

import React, { useState, useEffect, useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
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
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent } from "@/shared/components/ui/card";

import { QuestionWithDetails } from "@/features/questions/types/questions";
import { createClient } from "@/shared/services/client";
import { EditQuestionFormData } from "@/features/questions/hooks/use-edit-question-form";
import { TagAutocomplete } from "@/features/questions/components/create/tag-autocomplete";

interface Tag {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
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
  onTagsChange,
}: MetadataTabProps) {
  // Initialize with selected tags immediately for instant display
  const [availableTags, setAvailableTags] = useState<Tag[]>((question.tags as Tag[]) || []);

  // Get category name from preloaded data
  const categoryName = useMemo(() => {
    if (question.category && typeof question.category === "object" && "name" in question.category) {
      return question.category.name;
    }
    return "No Category";
  }, [question.category]);

  // Get question set name from preloaded data
  const questionSetName = useMemo(() => {
    const questionSet = question.set;
    return questionSet ? questionSet.name : "No Question Set";
  }, [question.set]);

  // Load all available tags in the background for the autocomplete dropdown
  useEffect(() => {
    const loadAllTags = async () => {
      try {
        const supabase = createClient();

        // Load all tags for the autocomplete search
        const { data: tagsData } = await supabase
          .from("tags")
          .select("*")
          .order("created_at", { ascending: false });

        if (tagsData) {
          // Merge with already-selected tags to ensure they're not lost
          const selectedTagObjects = question.tags || [];
          const allTagsMap = new Map<string, Tag>();

          // Add selected tags first to preserve them
          selectedTagObjects.forEach((tag) => {
            allTagsMap.set(tag.id, tag as Tag);
          });

          // Add all loaded tags
          tagsData.forEach((tag) => {
            if (!allTagsMap.has(tag.id)) {
              allTagsMap.set(tag.id, tag);
            }
          });

          setAvailableTags(Array.from(allTagsMap.values()));
        }
      } catch (error) {
        console.error("Error loading tags:", error);
      }
    };

    loadAllTags();
  }, [question.tags]);

  const handleTagsChange = (tagIds: string[]) => {
    onTagsChange(tagIds);
    onUnsavedChanges();
  };

  const handleTagCreated = (newTag: Tag) => {
    setAvailableTags((prev) => [...prev, newTag]);
  };

  return (
    <div className="space-y-6">
      {/* Difficulty */}
      <FormField
        control={form.control}
        name="difficulty"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-semibold">Difficulty</FormLabel>
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

      {/* Category (Read-Only) */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Category</Label>
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <p className="text-sm font-medium">{categoryName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Category cannot be changed after creation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Question Set (Read-Only) */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Question Set</Label>
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <p className="text-sm font-medium">{questionSetName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Question set cannot be changed after creation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tags */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Tags <span className="text-muted-foreground font-normal">(Optional)</span>
        </Label>
        <TagAutocomplete
          selectedTags={selectedTagIds}
          onTagsChange={handleTagsChange}
          allTags={availableTags}
          onTagCreated={handleTagCreated}
        />
      </div>
    </div>
  );
}
