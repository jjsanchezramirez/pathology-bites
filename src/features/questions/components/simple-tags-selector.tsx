// src/components/questions/simple-tags-selector.tsx
'use client';

import { useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Plus, X, Tag } from 'lucide-react';
import { useTags } from '@/features/questions/hooks/use-tags';
import { AddTagsDialog } from './add-tags-dialog';

interface SimpleTagsSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function SimpleTagsSelector({
  selectedTagIds,
  onTagsChange
}: SimpleTagsSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { tags, refetch } = useTags();

  // Get selected tags, with fallback for newly created tags that might not be in the list yet
  const selectedTags = selectedTagIds.map(id => {
    const existingTag = tags.find(tag => tag.id === id);
    if (existingTag) return existingTag;
    // Fallback for newly created tags
    return { id, name: `Loading...`, created_at: '', updated_at: '' };
  });

  // Handle dialog close and refetch tags to ensure we have the latest
  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Refetch tags when dialog closes to ensure we have any newly created tags
      refetch();
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Tags
        </Button>
      </div>

      {/* Selected Tags Display - More horizontal layout */}
      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-2 min-h-[32px] items-center">
          {selectedTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="min-h-[32px] flex items-center">
          <p className="text-sm text-muted-foreground">No tags selected</p>
        </div>
      )}

      <AddTagsDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        selectedTagIds={selectedTagIds}
        onTagsChange={onTagsChange}
      />
    </div>
  );
}
