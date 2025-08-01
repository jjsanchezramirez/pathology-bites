'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Textarea } from "@/shared/components/ui/textarea";

interface ReferencesTabProps {
  form: UseFormReturn<any>;
  onUnsavedChanges: () => void;
  mode?: 'create' | 'edit';
}

export function ReferencesTab({ form, mode = 'edit' }: ReferencesTabProps) {
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
            <FormLabel>References</FormLabel>
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
    </div>
  );
}
