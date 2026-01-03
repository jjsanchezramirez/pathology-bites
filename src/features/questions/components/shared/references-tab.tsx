'use client';

import React, { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { BookOpen } from 'lucide-react';
import { FetchReferencesDialog } from '../fetch-references-dialog';

interface ReferencesTabProps {
  form: UseFormReturn<unknown>;
  onUnsavedChanges: () => void;
  mode?: 'create' | 'edit';
}

export function ReferencesTab({ form, _mode = 'edit' }: ReferencesTabProps) {
  const [fetchDialogOpen, setFetchDialogOpen] = useState(false);

  const handleReferencesSelected = (references: string[]) => {
    const currentRefs = form.getValues('question_references') || '';
    const newRefs = references.join('\n\n');
    const updatedRefs = currentRefs
      ? `${currentRefs}\n\n${newRefs}`
      : newRefs;

    form.setValue('question_references', updatedRefs);
    if (onUnsavedChanges) {
      onUnsavedChanges();
    }
  };

  // Get search query from question title or stem
  const getSearchQuery = () => {
    const title = form.getValues('title') || '';
    const stem = form.getValues('stem') || '';
    return title || stem.slice(0, 100);
  };

  return (
    <div className="space-y-6">
      {/* Teaching Point */}
      <FormField
        control={form.control}
        name="teaching_point"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Teaching Point</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Enter the key learning point for this question"
                className="min-h-[120px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* References */}
      <FormField
        control={form.control}
        name="question_references"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>References</FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFetchDialogOpen(true)}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Fetch References
              </Button>
            </div>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Enter references, citations, or sources"
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FetchReferencesDialog
        open={fetchDialogOpen}
        onOpenChange={setFetchDialogOpen}
        searchQuery={getSearchQuery()}
        onReferencesSelected={handleReferencesSelected}
      />
    </div>
  );
}
