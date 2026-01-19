"use client";

import React, { useState, useEffect } from "react";
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
import { TagAutocomplete } from "@/app/(admin)/admin/create-question/components/tag-autocomplete";

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
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [categoryName, setCategoryName] = useState<string>("Loading...");
  const [questionSetName, setQuestionSetName] = useState<string>("Loading...");

  // Load tags, category name, and question set name
  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();

        // Load all tags
        const { data: tagsData } = await supabase
          .from("tags")
          .select("*")
          .order("created_at", { ascending: false });

        if (tagsData) {
          setAvailableTags(tagsData);
        }

        // Load category name
        if (question.category_id) {
          const { data: categoryData } = await supabase
            .from("categories")
            .select("name")
            .eq("id", question.category_id)
            .single();

          if (categoryData) {
            setCategoryName(categoryData.name);
          } else {
            setCategoryName("No Category");
          }
        } else {
          setCategoryName("No Category");
        }

        // Load question set name
        if (question.question_set_id) {
          const { data: questionSetData } = await supabase
            .from("question_sets")
            .select("name")
            .eq("id", question.question_set_id)
            .single();

          if (questionSetData) {
            setQuestionSetName(questionSetData.name);
          } else {
            setQuestionSetName("No Question Set");
          }
        } else {
          setQuestionSetName("No Question Set");
        }
      } catch (error) {
        console.error("Error loading metadata:", error);
      }
    };

    loadData();
  }, [question.category_id, question.question_set_id]);

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
